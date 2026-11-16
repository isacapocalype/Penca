import { get as idbGet, set as idbSet } from 'idb-keyval';
import initSqlJs, { type Database as SqlJsRawDatabase, type SqlJsStatic } from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import type { Database, SqlValue } from './types';
import { cleanRows } from './helpers';

type Row = Record<string, SqlValue | Uint8Array>;

const STORAGE_KEY = 'penca:browser-sqlite:v1';

let sqlPromise: Promise<SqlJsStatic> | null = null;

function loadSqlJs(): Promise<SqlJsStatic> {
  sqlPromise ??= initSqlJs(
    import.meta.env.MODE === 'test'
      ? undefined
      : {
          locateFile: (file) => (file.endsWith('.wasm') ? wasmUrl : file),
        },
  );

  return sqlPromise;
}

export interface SqlJsOptions {
  data?: Uint8Array;
  /** Simpan byte database ke IndexedDB agar mode browser tidak kehilangan data saat reload. */
  persist?: boolean;
}

/**
 * Adapter sql.js untuk pengujian Vitest dan fallback browser (mis. `npm run dev`
 * tanpa Android). Di perangkat Capacitor selalu memakai adapter native.
 */
export class SqlJsDatabase implements Database {
  readonly supportsDatabaseSnapshot = true;

  private writeChain: Promise<void> = Promise.resolve();

  private transactionDepth = 0;

  private constructor(
    private readonly database: SqlJsRawDatabase,
    private readonly persistEnabled: boolean,
  ) {}

  static async open(options: SqlJsOptions = {}): Promise<SqlJsDatabase> {
    const SQL = await loadSqlJs();
    let data = options.data;

    if (!data && options.persist && typeof indexedDB !== 'undefined') {
      try {
        data = (await idbGet<Uint8Array>(STORAGE_KEY)) ?? undefined;
      } catch {
        data = undefined;
      }
    }

    const database = new SQL.Database(data);
    const adapter = new SqlJsDatabase(database, Boolean(options.persist));

    await adapter.execute('PRAGMA foreign_keys = ON;');

    return adapter;
  }

  async execute(sql: string): Promise<void> {
    this.database.run(sql);
    this.persistSoon();
  }

  async run(sql: string, values: SqlValue[] = []): Promise<void> {
    this.database.run(sql, values);
    this.persistSoon();
  }

  async query<T = Record<string, unknown>>(sql: string, values: SqlValue[] = []): Promise<T[]> {
    const statement = this.database.prepare(sql);

    try {
      if (values.length > 0) {
        statement.bind(values);
      }

      const rows: Row[] = [];

      while (statement.step()) {
        rows.push(statement.getAsObject() as Row);
      }

      return cleanRows<T>(rows);
    } finally {
      statement.free();
    }
  }

  async transaction<T>(callback: () => Promise<T>): Promise<T> {
    const outer = this.transactionDepth === 0;
    const savepoint = `penca_sp_${this.transactionDepth}`;

    if (outer) {
      this.database.run('BEGIN IMMEDIATE');
    } else {
      this.database.run(`SAVEPOINT ${savepoint}`);
    }

    this.transactionDepth += 1;

    try {
      const result = await callback();
      this.transactionDepth -= 1;

      if (outer) {
        this.database.run('COMMIT');
        this.persistSoon();
      } else {
        this.database.run(`RELEASE SAVEPOINT ${savepoint}`);
      }

      return result;
    } catch (error) {
      this.transactionDepth = Math.max(0, this.transactionDepth - 1);

      try {
        if (outer) {
          this.database.run('ROLLBACK');
        } else {
          this.database.run(`ROLLBACK TO SAVEPOINT ${savepoint}`);
          this.database.run(`RELEASE SAVEPOINT ${savepoint}`);
        }
      } catch {
        // Transaksi mungkin sudah dibatalkan oleh SQLite (mis. constraint berat).
      }

      throw error;
    }
  }

  async snapshot(): Promise<Uint8Array> {
    return this.database.export();
  }

  async close(): Promise<void> {
    await this.flush();
    this.database.close();
  }

  private persistSoon(): void {
    if (!this.persistEnabled || typeof indexedDB === 'undefined') {
      return;
    }

    this.writeChain = this.writeChain
      .then(() => idbSet(STORAGE_KEY, this.database.export()))
      .catch(() => undefined);
  }

  async flush(): Promise<void> {
    await this.writeChain;
  }
}
