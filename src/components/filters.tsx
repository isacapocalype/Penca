import { useMemo, useState } from 'react';
import type { StoreWithMarketplace } from '../lib/types';
import {
  PERIOD_PRESETS,
  currentPeriod,
  periodEnd,
  periodStart,
  rangeForPreset,
  type PeriodPreset,
} from '../lib/date';
import { Field, Select, TextInput } from './ui';

export function usePeriodFilter(defaultPreset: PeriodPreset = 'this_month') {
  const [preset, setPreset] = useState<PeriodPreset>(defaultPreset);
  const [customStart, setCustomStart] = useState(periodStart(currentPeriod()));
  const [customEnd, setCustomEnd] = useState(periodEnd(currentPeriod()));
  const [storeId, setStoreId] = useState('');
  const range = useMemo(() => rangeForPreset(preset, customStart, customEnd), [preset, customStart, customEnd]);

  return {
    preset,
    setPreset,
    customStart,
    setCustomStart,
    customEnd,
    setCustomEnd,
    storeId,
    setStoreId,
    start: range.start,
    end: range.end,
  };
}

export function PeriodControls({
  preset,
  onPresetChange,
  customStart,
  customEnd,
  onCustomStartChange,
  onCustomEndChange,
  storeId,
  onStoreChange,
  stores,
  storeLabel = 'Semua toko',
}: {
  preset: PeriodPreset;
  onPresetChange: (preset: PeriodPreset) => void;
  customStart: string;
  customEnd: string;
  onCustomStartChange: (value: string) => void;
  onCustomEndChange: (value: string) => void;
  storeId: string;
  onStoreChange: (value: string) => void;
  stores: StoreWithMarketplace[];
  storeLabel?: string;
}) {
  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Periode">
          <Select value={preset} onChange={(event) => onPresetChange(event.target.value as PeriodPreset)}>
            {PERIOD_PRESETS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Toko">
          <Select value={storeId} onChange={(event) => onStoreChange(event.target.value)}>
            <option value="">{storeLabel}</option>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name} · {store.marketplace_name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {preset === 'custom' ? (
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Mulai">
            <TextInput type="date" value={customStart} onChange={(event) => onCustomStartChange(event.target.value)} />
          </Field>
          <Field label="Selesai">
            <TextInput type="date" value={customEnd} onChange={(event) => onCustomEndChange(event.target.value)} />
          </Field>
        </div>
      ) : null}
    </div>
  );
}
