import type { FittingRecord, AnomalyType } from '@/types';

const filterOptions: { key: AnomalyType | 'all'; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'onset_misjudgment', label: '起音点误判' },
  { key: 'noise_interference', label: '噪声干扰' },
  { key: 'parameter_out_of_bounds', label: '参数越界' },
];

function countByType(records: FittingRecord[], type: AnomalyType | 'all'): number {
  if (type === 'all') return records.length;
  return records.filter((r) => r.anomalies.some((a) => a.type === type)).length;
}

export default function AnomalyFilter({
  currentFilter,
  onFilterChange,
  records,
}: {
  currentFilter: string;
  onFilterChange: (filter: string) => void;
  records: FittingRecord[];
}) {
  return (
    <div className="flex items-center gap-2">
      {filterOptions.map((opt) => {
        const isActive = currentFilter === opt.key;
        const count = countByType(records, opt.key);

        return (
          <button
            key={opt.key}
            onClick={() => onFilterChange(opt.key)}
            className={`relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              isActive
                ? 'bg-synth-green/10 text-synth-green border border-synth-green/40 shadow-[0_0_12px_rgba(57,255,20,0.15)]'
                : 'bg-white/5 text-gray-400 border border-white/5 hover:border-white/15 hover:text-gray-300'
            }`}
          >
            {opt.label}
            <span
              className={`inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-mono-display font-semibold leading-none ${
                isActive
                  ? 'bg-synth-green/20 text-synth-green'
                  : 'bg-white/10 text-gray-500'
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
