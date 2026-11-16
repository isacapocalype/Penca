export type SqlValue = string | number | null;

export interface Database {
  /** Execute one or more SQL statements without bound values. */
  execute(sql: string): Promise<void>;
  /** Run a single write statement with bound values. */
  run(sql: string, values?: SqlValue[]): Promise<void>;
  /** Run a SELECT and return plain objects. */
  query<T = Record<string, unknown>>(sql: string, values?: SqlValue[]): Promise<T[]>;
  /** Execute a callback inside a transaction. Nested transactions are not supported. */
  transaction<T>(callback: () => Promise<T>): Promise<T>;
  /** False for environments that cannot produce a raw SQLite snapshot. */
  supportsDatabaseSnapshot: boolean;
  /** Raw database bytes, only when supportsDatabaseSnapshot is true. */
  snapshot?(): Promise<Uint8Array>;
  close(): Promise<void>;
}

export interface Migration {
  version: number;
  name: string;
  sql: string;
}
