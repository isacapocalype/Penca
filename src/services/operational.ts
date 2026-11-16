import type { Database } from '../lib/db/types';
import type { OperationalExpense, OperationalExpenseWithStore } from '../lib/types';
import { OPERATIONAL_CATEGORIES, type OperationalCategory } from '../lib/constants';
import { AppError } from '../lib/errors';
import { newId } from '../lib/id';
import { nowIso } from '../lib/db/helpers';
import { normalizeDate, periodEnd, periodStart } from '../lib/date';
import { assertDateUnlocked } from './period-locks';
import { recordAudit } from '../lib/audit';
import { parseRupiah } from '../lib/money';

export interface OperationalInput {
  store_id?: string | null;
  spent_at: string;
  category: OperationalCategory;
  amount: number | string;
  notes?: string | null;
}

export async function listOperationalExpenses(
  db: Database,
  period: string,
  filter: { storeId?: string | null; generalOnly?: boolean } = {},
): Promise<OperationalExpenseWithStore[]> {
  const params: Array<string | null> = [periodStart(period), periodEnd(period)];
  const clauses = ['oe.deleted_at IS NULL', 'oe.spent_at BETWEEN ? AND ?'];

  if (filter.generalOnly) {
    clauses.push('oe.store_id IS NULL');
  } else if (filter.storeId) {
    clauses.push('oe.store_id = ?');
    params.push(filter.storeId);
  }

  return db.query<OperationalExpenseWithStore>(
    `SELECT oe.*, s.name AS store_name
     FROM operational_expenses oe
     LEFT JOIN stores s ON s.id = oe.store_id
     WHERE ${clauses.join(' AND ')}
     ORDER BY oe.spent_at DESC, oe.created_at DESC
     LIMIT 200`,
    params,
  );
}

export async function getOperationalExpense(
  db: Database,
  expenseId: string,
): Promise<OperationalExpense | null> {
  const rows = await db.query<OperationalExpense>(
    'SELECT * FROM operational_expenses WHERE id = ? AND deleted_at IS NULL',
    [expenseId],
  );

  return rows[0] ?? null;
}

export async function saveOperationalExpense(
  db: Database,
  input: OperationalInput,
  expenseId: string | null = null,
): Promise<OperationalExpense> {
  const amount = parseRupiah(input.amount);

  if (amount <= 0) {
    throw new AppError('Biaya operasional harus lebih dari nol.');
  }

  if (!OPERATIONAL_CATEGORIES.includes(input.category)) {
    throw new AppError('Kategori biaya tidak dikenal.');
  }

  const spentAt = normalizeDate(input.spent_at);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(spentAt)) {
    throw new AppError('Tanggal biaya wajib diisi.');
  }

  await assertDateUnlocked(db, spentAt);

  if (input.store_id) {
    const store = await db.query<{ id: string }>('SELECT id FROM stores WHERE id = ? AND deleted_at IS NULL', [
      input.store_id,
    ]);

    if (store.length === 0) {
      throw new AppError('Toko tidak ditemukan.');
    }
  }

  const now = nowIso();
  const notes = input.notes?.trim() || null;

  if (expenseId) {
    const before = await getOperationalExpense(db, expenseId);

    if (!before) {
      throw new AppError('Biaya operasional tidak ditemukan.');
    }

    await assertDateUnlocked(db, before.spent_at);

    await db.transaction(async () => {
      await db.run(
        `UPDATE operational_expenses SET store_id = ?, spent_at = ?, category = ?, amount = ?, notes = ?, updated_at = ?
         WHERE id = ?`,
        [input.store_id || null, spentAt, input.category, amount, notes, now, expenseId],
      );
      await recordAudit(db, {
        type: 'operational_expense',
        id: expenseId,
        storeId: input.store_id || null,
        event: 'updated',
        summary: 'Biaya operasional diubah',
        before: { store_id: before.store_id, spent_at: before.spent_at, category: before.category, amount: before.amount, notes: before.notes },
        after: { store_id: input.store_id || null, spent_at: spentAt, category: input.category, amount, notes },
      });
    });

    return (await getOperationalExpense(db, expenseId))!;
  }

  const id = newId();

  await db.transaction(async () => {
    await db.run(
      `INSERT INTO operational_expenses
        (id, store_id, spent_at, category, amount, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, input.store_id || null, spentAt, input.category, amount, notes, now, now],
    );
    await recordAudit(db, {
      type: 'operational_expense',
      id,
      storeId: input.store_id || null,
      event: 'created',
      summary: `Biaya operasional ${spentAt} dicatat`,
      after: { store_id: input.store_id || null, spent_at: spentAt, category: input.category, amount, notes },
    });
  });

  return (await getOperationalExpense(db, id))!;
}

export async function deleteOperationalExpense(db: Database, expenseId: string): Promise<void> {
  const expense = await getOperationalExpense(db, expenseId);

  if (!expense) {
    throw new AppError('Biaya operasional tidak ditemukan.');
  }

  await assertDateUnlocked(db, expense.spent_at);
  const now = nowIso();

  await db.transaction(async () => {
    await db.run('UPDATE operational_expenses SET deleted_at = ?, updated_at = ? WHERE id = ?', [now, now, expenseId]);
    await recordAudit(db, {
      type: 'operational_expense',
      id: expenseId,
      storeId: expense.store_id,
      event: 'deleted',
      summary: `Biaya operasional ${expense.spent_at} dihapus`,
      before: { spent_at: expense.spent_at, category: expense.category, amount: expense.amount },
    });
  });
}
