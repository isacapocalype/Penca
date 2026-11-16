import type { Database } from './db/types';
import type { EntityType } from './constants';
import { newId } from './id';
import { nowIso } from './db/helpers';

export interface AuditInput {
  type: EntityType | null;
  id: string | null;
  storeId?: string | null;
  event: string;
  summary: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

export async function recordAudit(db: Database, input: AuditInput): Promise<void> {
  await db.run(
    `INSERT INTO audit_logs
      (id, auditable_type, auditable_id, store_id, event, summary, before_json, after_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newId(),
      input.type,
      input.id,
      input.storeId ?? null,
      input.event,
      input.summary,
      input.before ? JSON.stringify(input.before) : null,
      input.after ? JSON.stringify(input.after) : null,
      nowIso(),
    ],
  );
}

export function changedFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): Record<string, unknown> {
  const changes: Record<string, unknown> = {};

  for (const key of Object.keys(after)) {
    if (key === 'updated_at') {
      continue;
    }

    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changes[key] = before[key];
    }
  }

  return changes;
}
