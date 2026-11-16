import {
  CapacitorSQLite,
  SQLiteConnection,
  type SQLiteDBConnection,
} from '@capacitor-community/sqlite';
import type { Database, SqlValue } from './types';
import { cleanRows } from './helpers';

const DATABASE_NAME = 'penca';

/**
 * SQLite native via @capacitor-community/sqlite. Hanya dipakai ketika aplikasi
 * berjalan di Android/iOS; browser memakai adapter sql.js.
 */
export class CapacitorSqliteDatabase implements Database {
  readonly supportsDatabaseSnapshot = false;

  private transactionDepth = 0;

  private constructor(
    private readonly connection: SQLiteConnection,
    private readonly database: SQLiteDBConnection,
  ) {}

  static async open(): Promise<CapacitorSqliteDatabase> {
    const connection = new SQLiteConnection(CapacitorSQLite);
    const consistency = await connection.checkConnectionsConsistency();

    let database: SQLiteDBConnection;

    if (consistency.result) {
      const existing = await connection.isConnection(DATABASE_NAME, false);
      database = existing.result
        ? await connection.retrieveConnection(DATABASE_NAME, false)
        : await connection.createConnection(DATABASE_NAME, false, 'no-encryption', 1, false);
    } else {
      database = await connection.createConnection(DATABASE_NAME, false, 'no-encryption', 1, false);
    }

    const open = await database.isDBOpen();

    if (!open.result) {
      await database.open();
    }

    await database.execute('PRAGMA foreign_keys = ON;');

    return new CapacitorSqliteDatabase(connection, database);
  }

  async execute(sql: string): Promise<void> {
    await this.database.execute(sql, false);
  }

  async run(sql: string, values: SqlValue[] = []): Promise<void> {
    await this.database.run(sql, values, false);
  }

  async query<T = Record<string, unknown>>(sql: string, values: SqlValue[] = []): Promise<T[]> {
    const result = await this.database.query(sql, values);

    return cleanRows<T>((result.values ?? []) as Record<string, SqlValue>[]);
  }

  async transaction<T>(callback: () => Promise<T>): Promise<T> {
    const outer = this.transactionDepth === 0;
    const savepoint = `penca_sp_${this.transactionDepth}`;

    if (outer) {
      await this.database.beginTransaction();
    } else {
      await this.database.run(`SAVEPOINT ${savepoint}`);
    }

    this.transactionDepth += 1;

    try {
      const result = await callback();
      this.transactionDepth -= 1;

      if (outer) {
        await this.database.commitTransaction();
      } else {
        await this.database.run(`RELEASE SAVEPOINT ${savepoint}`);
      }

      return result;
    } catch (error) {
      this.transactionDepth = Math.max(0, this.transactionDepth - 1);

      try {
        if (outer) {
          await this.database.rollbackTransaction();
        } else {
          await this.database.run(`ROLLBACK TO SAVEPOINT ${savepoint}`);
          await this.database.run(`RELEASE SAVEPOINT ${savepoint}`);
        }
      } catch {
        // Transaksi mungkin sudah dibatalkan oleh SQLite (mis. constraint berat).
      }

      throw error;
    }
  }

  async close(): Promise<void> {
    await this.database.close();
  }
}
