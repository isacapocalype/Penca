import type { SqlValue } from './types';

type Row = Record<string, SqlValue | Uint8Array>;

export function cleanRow<T>(row: Row): T {
  const result: Record<string, SqlValue> = {};

  for (const [key, value] of Object.entries(row)) {
    result[key] = value instanceof Uint8Array ? Array.from(value).join(',') : value;
  }

  return result as T;
}

export function cleanRows<T>(rows: Row[]): T[] {
  return rows.map((row) => cleanRow<T>(row));
}

export function nowIso(): string {
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  return formatter.format(new Date()).replace(',', '');
}

export function todayJakarta(): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function placeholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(', ');
}

export function bool(value: unknown): boolean {
  return value === 1 || value === '1' || value === true || value === 'true';
}

export function numberOrNull(value: unknown): number | null {
  return value === null || value === undefined || value === '' ? null : Number(value);
}

export function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }

  return result;
}
