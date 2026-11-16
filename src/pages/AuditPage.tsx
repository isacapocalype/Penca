import { useState } from 'react';
import { ScrollText } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Feedback,
  Field,
  LoadingCard,
  SearchInput,
  SectionTitle,
  Select,
} from '../components/ui';
import { queryKeys, useDbQuery } from '../hooks/queries';
import { listStores } from '../services/stores';
import type { AuditLogWithStore } from '../lib/types';
import {
  AUDIT_EVENTS,
  AUDIT_EVENT_LABELS,
  ENTITY_TYPES,
  type AuditEvent,
  type EntityType,
} from '../lib/constants';
import { formatDateTime } from '../lib/date';
import { formatInteger } from '../lib/money';
import { errorMessage } from '../lib/errors';

type EventTone = 'neutral' | 'primary' | 'success' | 'danger' | 'info' | 'warning';

function eventTone(event: string): EventTone {
  switch (event) {
    case 'created':
      return 'success';
    case 'deleted':
      return 'danger';
    case 'restored':
      return 'info';
    case 'locked':
      return 'warning';
    case 'unlocked':
      return 'primary';
    default:
      return 'neutral';
  }
}

function parseDetail(value: string | null): Record<string, unknown> {
  if (!value) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(value);

    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function formatKey(key: string): string {
  return key.replace(/_/g, ' ');
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  if (typeof value === 'boolean') {
    return value ? 'Ya' : 'Tidak';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

function entityLabel(type: string | null): string {
  if (!type) {
    return 'Sistem';
  }

  return type in ENTITY_TYPES ? ENTITY_TYPES[type as EntityType] : type;
}

function eventLabel(event: string): string {
  return AUDIT_EVENT_LABELS[event as AuditEvent] ?? event;
}

export default function AuditPage() {
  const [event, setEvent] = useState('');
  const [storeId, setStoreId] = useState('');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(50);
  const [expanded, setExpanded] = useState<string | null>(null);

  const storesQuery = useDbQuery(queryKeys.stores(), (db) => listStores(db));
  const auditQuery = useDbQuery(
    queryKeys.audit(`${event}|${storeId}|${search}|${limit}`),
    async (db) => {
      const clauses: string[] = ['1 = 1'];
      const params: Array<string | number> = [];

      if (event) {
        clauses.push('al.event = ?');
        params.push(event);
      }

      if (storeId) {
        clauses.push('al.store_id = ?');
        params.push(storeId);
      }

      if (search.trim()) {
        const term = `%${search.trim()}%`;
        clauses.push('(al.summary LIKE ? OR al.auditable_id LIKE ?)');
        params.push(term, term);
      }

      const where = clauses.join(' AND ');
      const totalRows = await db.query<{ count: number }>(
        `SELECT COUNT(*) AS count FROM audit_logs al WHERE ${where}`,
        params,
      );
      const logs = await db.query<AuditLogWithStore>(
        `SELECT al.*, s.name AS store_name
         FROM audit_logs al
         LEFT JOIN stores s ON s.id = al.store_id
         WHERE ${where}
         ORDER BY al.created_at DESC
         LIMIT ?`,
        [...params, limit],
      );
      const total = Number(totalRows[0]?.count ?? 0);

      return { logs, total, hasMore: logs.length < total && logs.length === limit };
    },
  );

  const stores = storesQuery.data ?? [];
  const data = auditQuery.data;
  const logs = data?.logs ?? [];

  const resetFilters = () => {
    setEvent('');
    setStoreId('');
    setSearch('');
    setLimit(50);
    setExpanded(null);
  };

  const changeEvent = (value: string) => {
    setEvent(value);
    setLimit(50);
    setExpanded(null);
  };

  const changeStore = (value: string) => {
    setStoreId(value);
    setLimit(50);
    setExpanded(null);
  };

  const changeSearch = (value: string) => {
    setSearch(value);
    setLimit(50);
    setExpanded(null);
  };

  if (storesQuery.isLoading || auditQuery.isLoading) {
    return (
      <div className="space-y-3">
        <LoadingCard rows={4} />
        <LoadingCard rows={7} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Feedback
        error={auditQuery.error ? errorMessage(auditQuery.error, 'Audit log gagal dibaca.') : null}
        onDismiss={() => undefined}
      />

      <Card className="space-y-2.5 p-4">
        <div className="flex items-center justify-between gap-2">
          <SectionTitle title="Filter" hint="Audit log tidak dapat diedit atau dihapus" className="mb-0" />
          <Button size="sm" variant="ghost" onClick={resetFilters}>
            Reset
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Peristiwa">
            <Select value={event} onChange={(event) => changeEvent(event.target.value)}>
              <option value="">Semua peristiwa</option>
              {AUDIT_EVENTS.map((item) => (
                <option key={item} value={item}>
                  {AUDIT_EVENT_LABELS[item]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Toko">
            <Select value={storeId} onChange={(event) => changeStore(event.target.value)}>
              <option value="">Semua toko</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name} · {store.marketplace_name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Cari ringkasan atau ID">
          <SearchInput
            value={search}
            onChange={changeSearch}
            placeholder="Order ID, produk, ringkasan"
          />
        </Field>

        <p className="text-[0.68rem] text-secondary">
          Menampilkan {formatInteger(logs.length)} dari {formatInteger(data?.total ?? 0)} catatan.
        </p>
      </Card>

      {logs.length === 0 ? (
        <Card className="p-4">
          <EmptyState
            icon={ScrollText}
            title="Tidak ada catatan audit"
            description="Setiap pembuatan, perubahan, penghapusan, dan restore data akan tercatat di sini."
          />
        </Card>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => {
            const before = parseDetail(log.before_json);
            const after = parseDetail(log.after_json);
            const expandedNow = expanded === log.id;
            const changedKeys = Object.keys(before);

            return (
              <Card key={log.id} className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={eventTone(log.event)}>{eventLabel(log.event)}</Badge>
                      <span className="text-[0.65rem] text-secondary">{entityLabel(log.auditable_type)}</span>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-on-surface">{log.summary}</p>
                    <p className="mt-0.5 text-[0.65rem] text-secondary">
                      {formatDateTime(log.created_at)} · {log.store_name ?? 'Umum / tanpa toko'}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setExpanded(expandedNow ? null : log.id)}
                  >
                    {expandedNow ? 'Tutup' : 'Detail'}
                  </Button>
                </div>

                {expandedNow ? (
                  Object.keys(before).length === 0 && Object.keys(after).length === 0 ? (
                    <p className="text-[0.68rem] text-secondary">
                      Tidak ada detail atribut untuk catatan ini.
                    </p>
                  ) : log.event === 'updated' && changedKeys.length > 0 ? (
                    <div className="rounded-2xl bg-surface-muted p-3">
                      <p className="text-[0.65rem] font-semibold text-secondary">Perubahan</p>
                      <div className="mt-1 divide-y divide-outline/70">
                        {changedKeys.map((key) => (
                          <div key={key} className="flex items-start justify-between gap-3 py-1.5">
                            <p className="flex-1 text-[0.68rem] text-secondary">{formatKey(key)}</p>
                            <div className="flex-1 text-right">
                              <p className="text-[0.68rem] text-muted line-through">{formatValue(before[key])}</p>
                              <p className="text-[0.68rem] font-medium text-on-surface">
                                {formatValue(after[key])}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      {Object.keys(before).length > 0 ? (
                        <div className="rounded-2xl bg-surface-muted p-3">
                          <p className="text-[0.65rem] font-semibold text-secondary">Sebelum</p>
                          <div className="mt-1 divide-y divide-outline/70">
                            {Object.entries(before).map(([key, value]) => (
                              <div key={key} className="flex items-start justify-between gap-3 py-1.5">
                                <p className="flex-1 text-[0.68rem] text-secondary">{formatKey(key)}</p>
                                <p className="flex-1 text-right text-[0.68rem] text-on-surface">
                                  {formatValue(value)}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {Object.keys(after).length > 0 ? (
                        <div className="rounded-2xl bg-surface-muted p-3">
                          <p className="text-[0.65rem] font-semibold text-secondary">Sesudah</p>
                          <div className="mt-1 divide-y divide-outline/70">
                            {Object.entries(after).map(([key, value]) => (
                              <div key={key} className="flex items-start justify-between gap-3 py-1.5">
                                <p className="flex-1 text-[0.68rem] text-secondary">{formatKey(key)}</p>
                                <p className="flex-1 text-right text-[0.68rem] text-on-surface">
                                  {formatValue(value)}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </>
                  )
                ) : null}
              </Card>
            );
          })}

          {data?.hasMore ? (
            <Button fullWidth variant="secondary" onClick={() => setLimit((current) => current + 50)}>
              Muat 50 catatan lagi
            </Button>
          ) : (
            <p className="px-1 text-center text-[0.65rem] text-muted">
              Semua catatan yang cocok sudah ditampilkan.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
