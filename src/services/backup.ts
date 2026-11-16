import type { Database } from '../lib/db/types';
import type { Backup } from '../lib/types';
import { ALL_TABLES, SCHEMA_VERSION } from '../lib/db/schema';
import { newId } from '../lib/id';
import { nowIso } from '../lib/db/helpers';
import { AppError } from '../lib/errors';
import { getSetting, getSettingBool, getSettingInt, putSetting } from './settings';
import { byteLength, sha256Hex } from '../lib/hash';
import { deleteStoredFile, readTextFile, shareStoredFile, storedFileExists, writeTextFile } from '../lib/files';
import { recordAudit } from '../lib/audit';
import { today } from '../lib/date';

export const BACKUP_SCHEMA_VERSION = SCHEMA_VERSION;

export const BACKUP_REASON_LABELS: Record<string, string> = {
  manual: 'Manual',
  auto: 'Otomatis',
  pre_restore: 'Pengaman sebelum restore',
};

interface BackupPayload {
  app: string;
  schema_version: number;
  created_at: string;
  checksum: string;
  tables: Record<string, Array<Record<string, unknown>>>;
}

type Row = Record<string, unknown>;

function timestampSlug(createdAt: string): string {
  return createdAt.replace(/\D/g, '').slice(0, 14);
}

function cleanValue(value: unknown): string | number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number' || typeof value === 'string') {
    return value;
  }

  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }

  return JSON.stringify(value);
}

async function uniqueBackupPath(dbName: string, reason: string): Promise<{ base: string; path: string }> {
  const base = `penca-${dbName}-${reason}`;
  let candidate = `backups/${base}.json`;
  let counter = 1;

  while (await storedFileExists(candidate)) {
    candidate = `backups/${base}-${counter}.json`;
    counter += 1;
  }

  return { base, path: candidate };
}

export async function backupTables(db: Database): Promise<Record<string, Row[]>> {
  const tables: Record<string, Row[]> = {};

  for (const table of ALL_TABLES) {
    tables[table] = await db.query<Row>(`SELECT * FROM "${table}"`);
  }

  return tables;
}

export async function createBackup(db: Database, reason = 'manual'): Promise<Backup> {
  const createdAt = nowIso();
  const tables = await backupTables(db);
  const checksum = await sha256Hex(JSON.stringify(tables));
  const payload: BackupPayload = {
    app: 'Penca',
    schema_version: BACKUP_SCHEMA_VERSION,
    created_at: createdAt,
    checksum,
    tables,
  };
  const json = JSON.stringify(payload, null, 2);
  const { base, path } = await uniqueBackupPath(timestampSlug(createdAt), reason);

  await writeTextFile(path, json);

  const fileChecksum = await sha256Hex(json);
  const id = newId();

  await db.run(
    `INSERT INTO backups
      (id, file_name, json_path, db_path, size, schema_version, checksum, reason, created_at, restored_at)
     VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, NULL)`,
    [id, base, path, byteLength(json), BACKUP_SCHEMA_VERSION, fileChecksum, reason, createdAt],
  );

  if (reason === 'auto') {
    await putSetting(db, 'last_auto_backup_at', createdAt);
  }

  await pruneBackups(db);

  return (await db.query<Backup>('SELECT * FROM backups WHERE id = ?', [id]))[0];
}

export async function backupHistory(db: Database, limit = 20): Promise<Backup[]> {
  return db.query<Backup>('SELECT * FROM backups ORDER BY created_at DESC LIMIT ?', [limit]);
}

export async function lastBackup(db: Database): Promise<Backup | null> {
  const rows = await db.query<Backup>('SELECT * FROM backups ORDER BY created_at DESC LIMIT 1');

  return rows[0] ?? null;
}

export async function autoBackupIfDue(db: Database): Promise<Backup | null> {
  if (!(await getSettingBool(db, 'auto_backup_enabled', true))) {
    return null;
  }

  const last = await getSetting(db, 'last_auto_backup_at');

  if (last && last.slice(0, 10) === today()) {
    return null;
  }

  return createBackup(db, 'auto');
}

export async function pruneBackups(db: Database): Promise<number> {
  const retention = Math.max(1, await getSettingInt(db, 'backup_retention', 10));
  const backups = await db.query<Backup>('SELECT * FROM backups ORDER BY created_at DESC');
  let deleted = 0;

  for (const backup of backups.slice(retention)) {
    await deleteStoredFile(backup.json_path);
    await db.run('DELETE FROM backups WHERE id = ?', [backup.id]);
    deleted += 1;
  }

  return deleted;
}

export async function shareBackup(backup: Backup): Promise<string> {
  return shareStoredFile(backup.json_path, `Backup Penca ${backup.file_name}`, 'application/json');
}

function parsePayload(text: string): BackupPayload {
  let payload: unknown;

  try {
    payload = JSON.parse(text);
  } catch {
    throw new AppError('File bukan backup JSON Penca yang valid.');
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new AppError('File bukan backup JSON Penca yang valid.');
  }

  const candidate = payload as Partial<BackupPayload>;

  if (candidate.app !== 'Penca') {
    throw new AppError('File bukan backup Penca.');
  }

  if (Number(candidate.schema_version ?? 0) > BACKUP_SCHEMA_VERSION) {
    throw new AppError('Backup dibuat oleh versi skema yang lebih baru. Perbarui aplikasi terlebih dahulu.');
  }

  if (!candidate.tables || typeof candidate.tables !== 'object' || Array.isArray(candidate.tables)) {
    throw new AppError('Struktur tabel backup tidak lengkap.');
  }

  for (const required of ['stores', 'orders', 'order_items', 'products', 'settings']) {
    if (!(required in candidate.tables)) {
      throw new AppError(`Backup tidak memiliki tabel wajib ${required}.`);
    }
  }

  return candidate as BackupPayload;
}

function assertPayloadChecksum(payload: BackupPayload): Promise<void> {
  return sha256Hex(JSON.stringify(payload.tables)).then((checksum) => {
    if (checksum !== payload.checksum) {
      throw new AppError('Checksum backup tidak cocok. File rusak atau diubah.');
    }
  });
}

async function tableColumns(db: Database, table: string): Promise<string[]> {
  const rows = await db.query<{ name: string }>(`PRAGMA table_info("${table}")`);

  return rows.map((row) => row.name);
}

function quote(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

async function replaceData(db: Database, payload: BackupPayload): Promise<void> {
  for (const table of [...ALL_TABLES].reverse()) {
    await db.run(`DELETE FROM ${quote(table)}`);
  }

  for (const table of ALL_TABLES) {
    const rows = payload.tables[table] ?? [];

    if (!Array.isArray(rows) || rows.length === 0) {
      continue;
    }

    const columns = await tableColumns(db, table);
    const allowed = new Set(columns);

    for (let index = 0; index < rows.length; index += 100) {
      const chunk = rows.slice(index, index + 100).filter((row): row is Row => Boolean(row) && typeof row === 'object');

      if (chunk.length === 0) {
        continue;
      }

      const keys = columns.filter((column) => chunk.some((row) => column in row && allowed.has(column)));

      if (keys.length === 0) {
        throw new AppError(`Backup tabel ${table} tidak memiliki kolom yang cocok.`);
      }

      const placeholders = keys.map(() => '?').join(', ');
      const sql = `INSERT INTO ${quote(table)} (${keys.map(quote).join(', ')}) VALUES (${placeholders})`;

      for (const row of chunk) {
        await db.run(sql, keys.map((key) => cleanValue(row[key])));
      }
    }
  }
}

/**
 * Restore JSON Penca. Backup pengaman dibuat lebih dulu; bila pembuatan
 * backup pengaman gagal, restore dibatalkan. Bila restore gagal, transaksi
 * dibatalkan dan data lama tidak berubah.
 */
export async function restoreBackupText(db: Database, text: string, sourceName = 'file backup'): Promise<Backup> {
  const payload = parsePayload(text);
  await assertPayloadChecksum(payload);

  const safety = await createBackup(db, 'pre_restore');
  const restoredAt = nowIso();

  try {
    await db.transaction(async () => {
      await replaceData(db, payload);

      await recordAudit(db, {
        type: null,
        id: null,
        event: 'restored',
        summary: `Data dipulihkan dari backup ${sourceName}`,
        after: { file: sourceName, restored_at: restoredAt },
      });
    });
  } catch (error) {
    throw new AppError(
      `Restore gagal dan data lama tidak diubah. Backup pengaman tersimpan di riwayat. ${
        error instanceof Error ? error.message : ''
      }`.trim(),
    );
  }

  const fileChecksum = await sha256Hex(text);
  await db.run('UPDATE backups SET restored_at = ? WHERE checksum = ? AND restored_at IS NULL', [
    restoredAt,
    fileChecksum,
  ]);

  // Backup pengaman dibuat sebelum tabel backups diganti, jadi barisnya
  // dimasukkan kembali agar tetap terlihat di riwayat.
  await db.run(
    `INSERT OR REPLACE INTO backups
      (id, file_name, json_path, db_path, size, schema_version, checksum, reason, created_at, restored_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      safety.id,
      safety.file_name,
      safety.json_path,
      safety.db_path,
      safety.size,
      safety.schema_version,
      safety.checksum,
      safety.reason,
      safety.created_at,
      safety.restored_at,
    ],
  );

  return safety;
}

export async function restoreBackupFromPath(db: Database, path: string): Promise<Backup> {
  const text = await readTextFile(path);

  return restoreBackupText(db, text, path.split('/').pop() ?? path);
}

export async function backupFileExists(backup: Backup): Promise<boolean> {
  return storedFileExists(backup.json_path);
}
