import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDatabase, createTestDatabase } from './index';
import type { Database } from './types';
import { makeOrder, makeStore } from '../../test/fixtures';

let db: Database;

beforeEach(async () => {
  db = await createTestDatabase();
});

afterEach(async () => {
  await db.close();
  await closeDatabase();
});

describe('test database', () => {
  it('creates a store and order in sql.js', async () => {
    const store = await makeStore(db);
    const order = await makeOrder(db, store.id);

    expect(store.name).toBe('Konveksi Amanah');
    expect(order.gross_revenue).toBe(100_000);
    expect(order.hpp_total).toBe(40_000);
  });
});
