import type { Database } from '../lib/db/types';
import type { PeriodLock } from '../lib/types';
import { newId } from '../lib/id';
import { nowIso } from '../lib/db/helpers';
import { AppError } from '../lib/errors';
import { monthLabel, periodFromDate } from '../lib/date';
import { recordAudit } from '../lib/audit';

export async function isPeriodLocked(db: Database, period: string): Promise<boolean> {
  const rows = await db.query<{ count: number }>(
    'SELECT COUNT(*) AS count FROM period_locks WHERE period = ?',
    [period],
  );

  return Number(rows[0]?.count ?? 0) > 0;
}

export async function assertPeriodsUnlocked(db: Database, periods: Array<string | null | undefined>): Promise<void> {
  const unique = [...new Set(periods.filter((period): period is string => Boolean(period)))];

  for (const period of unique) {
    if (await isPeriodLocked(db, period)) {
      throw new AppError(`Periode ${monthLabel(period)} terkunci. Buka kunci di Pengaturan untuk mengubah data.`);
    }
  }
}

export async function assertDateUnlocked(db: Database, date: string | null | undefined): Promise<void> {
  if (!date) {
    return;
  }

  await assertPeriodsUnlocked(db, [periodFromDate(date)]);
}

export async function lockPeriod(
  db: Database,
  period: string,
  actor: string,
  notes: string | null = null,
): Promise<PeriodLock> {
  const existing = await db.query<PeriodLock>('SELECT * FROM period_locks WHERE period = ?', [period]);

  if (existing[0]) {
    return existing[0];
  }

  const now = nowIso();
  const id = newId();

  await db.transaction(async () => {
    await db.run(
      `INSERT INTO period_locks (id, period, locked_at, locked_by, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, period, now, actor, notes, now, now],
    );

    await recordAudit(db, {
      type: 'period_lock',
      id,
      event: 'locked',
      summary: `Periode ${monthLabel(period)} dikunci oleh ${actor}`,
      after: { period, locked_by: actor, notes },
    });
  });

  return (await db.query<PeriodLock>('SELECT * FROM period_locks WHERE id = ?', [id]))[0];
}

export async function unlockPeriod(db: Database, period: string, actor: string): Promise<void> {
  const existing = (await db.query<PeriodLock>('SELECT * FROM period_locks WHERE period = ?', [period]))[0];

  if (!existing) {
    return;
  }

  await db.transaction(async () => {
    await db.run('DELETE FROM period_locks WHERE period = ?', [period]);
    await recordAudit(db, {
      type: 'period_lock',
      id: existing.id,
      event: 'unlocked',
      summary: `Kunci periode ${monthLabel(period)} dibuka oleh ${actor}`,
      before: { period, locked_by: existing.locked_by, notes: existing.notes },
    });
  });
}

export async function listPeriodLocks(db: Database): Promise<PeriodLock[]> {
  return db.query<PeriodLock>('SELECT * FROM period_locks ORDER BY period DESC');
}
