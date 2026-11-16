import dayjs, { type Dayjs } from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import 'dayjs/locale/id';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);
dayjs.locale('id');

export const TIMEZONE = 'Asia/Jakarta';

export const MONTH_NAMES = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

export function today(): string {
  return dayjs().tz(TIMEZONE).format('YYYY-MM-DD');
}

export function nowIso(): string {
  return dayjs().tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss');
}

export function currentPeriod(): string {
  return today().slice(0, 7);
}

export function normalizeDate(value: string | Dayjs | Date | null | undefined): string {
  if (!value) {
    return today();
  }

  if (dayjs.isDayjs(value)) {
    return value.format('YYYY-MM-DD');
  }

  if (value instanceof Date) {
    return dayjs(value).tz(TIMEZONE).format('YYYY-MM-DD');
  }

  const clean = String(value).trim();
  const formats = ['YYYY-MM-DD', 'DD/MM/YYYY', 'DD-MM-YYYY', 'YYYY/MM/DD', 'D MMM YYYY', 'D MMMM YYYY'];

  for (const format of formats) {
    const parsed = dayjs(clean, format, true);

    if (parsed.isValid() && parsed.format(format) === clean) {
      return parsed.format('YYYY-MM-DD');
    }
  }

  const parsed = dayjs(clean);

  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : clean;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }

  const parsed = dayjs(normalizeDate(value));

  return parsed.isValid() ? parsed.locale('id').format('D MMM YYYY') : value;
}

export function formatLongDate(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }

  const parsed = dayjs(normalizeDate(value));

  return parsed.isValid() ? parsed.locale('id').format('D MMMM YYYY') : value;
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }

  const parsed = dayjs(value.replace('T', ' ').slice(0, 19));

  return parsed.isValid() ? parsed.locale('id').format('D MMM YYYY HH:mm') : value;
}

export function formatTime(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }

  const parsed = dayjs(value.replace('T', ' ').slice(0, 19));

  return parsed.isValid() ? parsed.format('HH:mm') : value;
}

export function periodFromDate(value: string): string {
  return normalizeDate(value).slice(0, 7);
}

export function assertPeriod(period: string): void {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
    throw new Error('Periode harus dalam format YYYY-MM.');
  }
}

export function periodStart(period: string): string {
  assertPeriod(period);

  return `${period}-01`;
}

export function periodEnd(period: string): string {
  assertPeriod(period);

  return dayjs(`${period}-01`).endOf('month').format('YYYY-MM-DD');
}

export function monthLabel(period: string): string {
  assertPeriod(period);
  const [year, month] = period.split('-');

  return `${MONTH_NAMES[Number(month) - 1]} ${year}`;
}

export function periodLabel(start: string, end: string): string {
  if (start === end) {
    return formatLongDate(start);
  }

  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  const startLabel = sameYear ? formatDate(start) : formatLongDate(start);
  const endLabel = formatLongDate(end);

  return `${startLabel} – ${endLabel}`;
}

export function monthOptions(count = 24, from = currentPeriod()): Array<{ value: string; label: string }> {
  const options: Array<{ value: string; label: string }> = [];
  let cursor = dayjs(`${from}-01`);

  for (let index = 0; index < count; index++) {
    const period = cursor.format('YYYY-MM');
    options.push({ value: period, label: monthLabel(period) });
    cursor = cursor.subtract(1, 'month');
  }

  return options;
}

export type PeriodPreset = 'today' | 'yesterday' | '7d' | '30d' | 'this_month' | 'last_month' | 'custom';

export const PERIOD_PRESETS: Array<{ value: PeriodPreset; label: string }> = [
  { value: 'today', label: 'Hari ini' },
  { value: 'yesterday', label: 'Kemarin' },
  { value: '7d', label: '7 hari terakhir' },
  { value: '30d', label: '30 hari terakhir' },
  { value: 'this_month', label: 'Bulan ini' },
  { value: 'last_month', label: 'Bulan lalu' },
  { value: 'custom', label: 'Rentang khusus' },
];

export function rangeForPreset(
  preset: PeriodPreset,
  customStart?: string,
  customEnd?: string,
): { start: string; end: string } {
  const base = dayjs().tz(TIMEZONE).startOf('day');

  switch (preset) {
    case 'today':
      return { start: base.format('YYYY-MM-DD'), end: base.format('YYYY-MM-DD') };
    case 'yesterday': {
      const date = base.subtract(1, 'day').format('YYYY-MM-DD');

      return { start: date, end: date };
    }
    case '7d':
      return { start: base.subtract(6, 'day').format('YYYY-MM-DD'), end: base.format('YYYY-MM-DD') };
    case '30d':
      return { start: base.subtract(29, 'day').format('YYYY-MM-DD'), end: base.format('YYYY-MM-DD') };
    case 'this_month':
      return { start: base.startOf('month').format('YYYY-MM-DD'), end: base.endOf('month').format('YYYY-MM-DD') };
    case 'last_month': {
      const previous = base.subtract(1, 'month');

      return {
        start: previous.startOf('month').format('YYYY-MM-DD'),
        end: previous.endOf('month').format('YYYY-MM-DD'),
      };
    }
    case 'custom':
      return {
        start: customStart ? normalizeDate(customStart) : base.format('YYYY-MM-DD'),
        end: customEnd ? normalizeDate(customEnd) : base.format('YYYY-MM-DD'),
      };
  }
}

export function previousRange(
  preset: PeriodPreset,
  start: string,
  end: string,
): { start: string; end: string } {
  if (preset === 'this_month' || preset === 'last_month') {
    const previous = dayjs(`${start.slice(0, 7)}-01`).subtract(1, 'month');

    return {
      start: previous.startOf('month').format('YYYY-MM-DD'),
      end: previous.endOf('month').format('YYYY-MM-DD'),
    };
  }

  const startDate = dayjs(start);
  const endDate = dayjs(end);
  const days = endDate.diff(startDate, 'day') + 1;

  return {
    start: startDate.subtract(days, 'day').format('YYYY-MM-DD'),
    end: startDate.subtract(1, 'day').format('YYYY-MM-DD'),
  };
}

export function datesBetween(start: string, end: string): string[] {
  const dates: string[] = [];
  let cursor = dayjs(start);

  while (cursor.format('YYYY-MM-DD') <= end) {
    dates.push(cursor.format('YYYY-MM-DD'));
    cursor = cursor.add(1, 'day');
  }

  return dates;
}
