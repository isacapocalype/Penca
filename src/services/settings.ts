import type { Database } from '../lib/db/types';
import { nowIso } from '../lib/db/helpers';

export async function getSetting(db: Database, key: string, fallback: string | null = null): Promise<string | null> {
  const rows = await db.query<{ value: string | null }>('SELECT value FROM settings WHERE key = ?', [key]);

  return rows[0]?.value ?? fallback;
}

export async function getSettingInt(db: Database, key: string, fallback = 0): Promise<number> {
  const value = await getSetting(db, key);

  if (value === null || value === '') {
    return fallback;
  }

  return Number.parseInt(value, 10) || 0;
}

export async function getSettingBool(db: Database, key: string, fallback = false): Promise<boolean> {
  const value = await getSetting(db, key);

  if (value === null) {
    return fallback;
  }

  return ['1', 'true', 'yes'].includes(value);
}

export async function putSetting(
  db: Database,
  key: string,
  value: string | number | boolean | null,
): Promise<void> {
  const now = nowIso();
  const stored = typeof value === 'boolean' ? (value ? '1' : '0') : value === null ? null : String(value);

  await db.run(
    `INSERT INTO settings (key, value, created_at, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [key, stored, now, now],
  );
}

export async function getSettings(db: Database): Promise<Record<string, string | null>> {
  const rows = await db.query<{ key: string; value: string | null }>('SELECT key, value FROM settings');
  const settings: Record<string, string | null> = {};

  for (const row of rows) {
    settings[row.key] = row.value;
  }

  return settings;
}
