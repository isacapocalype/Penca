import { Capacitor } from '@capacitor/core';
import { CapacitorSqliteDatabase } from './capacitor';
import { SqlJsDatabase } from './sqljs';
import { SCHEMA_SQL, SCHEMA_VERSION, SEED_SQL } from './schema';
import type { Database } from './types';
import { nowIso } from './helpers';

let activeDatabase: Database | null = null;
let initialization: Promise<Database> | null = null;

export interface OpenDatabaseOptions {
  /** Paksa fallback sql.js meskipun berjalan di perangkat. */
  forceWeb?: boolean;
  /** Simpan database browser ke IndexedDB. Default aktif di browser. */
  persist?: boolean;
}

export async function openDatabase(options: OpenDatabaseOptions = {}): Promise<Database> {
  const native = Capacitor.isNativePlatform() && !options.forceWeb;

  if (native) {
    return CapacitorSqliteDatabase.open();
  }

  return SqlJsDatabase.open({
    persist: options.persist ?? Capacitor.getPlatform() === 'web',
  });
}

export async function migrate(db: Database): Promise<void> {
  await db.execute('PRAGMA foreign_keys = ON;');
  await db.execute(SCHEMA_SQL);
  await db.execute(SEED_SQL);

  const applied = await db.query<{ version: number }>(
    'SELECT version FROM schema_migrations WHERE version = ?',
    [SCHEMA_VERSION],
  );

  if (applied.length === 0) {
    await db.run(
      'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
      [SCHEMA_VERSION, 'initial-capacitor', nowIso()],
    );
  }
}

/** Inisialisasi database aplikasi dan jadikan singleton untuk lapisan UI. */
export async function initDatabase(options: OpenDatabaseOptions = {}): Promise<Database> {
  if (activeDatabase) {
    return activeDatabase;
  }

  initialization ??= (async () => {
    const db = await openDatabase(options);
    await migrate(db);
    activeDatabase = db;

    return db;
  })();

  try {
    return await initialization;
  } catch (error) {
    initialization = null;
    throw error;
  }
}

/** Database terisolasi untuk pengujian. */
export async function createTestDatabase(): Promise<Database> {
  const db = await SqlJsDatabase.open({ persist: false });
  await migrate(db);

  return db;
}

export function getDb(): Database {
  if (!activeDatabase) {
    throw new Error('Database belum diinisialisasi.');
  }

  return activeDatabase;
}

export function setDatabase(db: Database | null): void {
  activeDatabase = db;
}

export async function closeDatabase(): Promise<void> {
  if (activeDatabase) {
    await activeDatabase.close();
    activeDatabase = null;
    initialization = null;
  }
}
