import type { Quaternion } from '@/types';
import { quatNorm, quatIsNormalized } from '@/utils/quaternion';
import DataTag from './DataTag';

interface QuaternionInputProps {
  label: string;
  quaternion: Quaternion;
  onChange: (q: Quaternion) => void;
  onNormalize: () => void;
}

export default function QuaternionInput({ label, quaternion, onChange, onNormalize }: QuaternionInputProps) {
  const norm = quatNorm(quaternion);
  const isNormalized = quatIsNormalized(quaternion);

  const handleChange = (key: keyof Pick<Quaternion, 'w' | 'x' | 'y' | 'z'>, value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return;
    onChange({ ...quaternion, [key]: num });
  };

  const fields: { key: keyof Pick<Quaternion, 'w' | 'x' | 'y' | 'z'>; label: string }[] = [
    { key: 'w', label: 'w' },
    { key: 'x', label: 'x' },
    { key: 'y', label: 'y' },
    { key: 'z', label: 'z' },
  ];

  return (
    <div
      className="rounded-lg p-3"
      style={{
        backgroundColor: 'rgba(10,14,39,0.8)',
        border: `1px solid ${isNormalized ? 'rgba(148,163,184,0.15)' : 'rgba(251,191,36,0.5)'}`,
      }}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-sm text-[#94a3b8]">{label}</span>
        <DataTag tag={quaternion.source} />
      </div>

      <div className="grid grid-cols-4 gap-2">
        {fields.map(({ key, label: l }) => (
          <div key={key} className="flex flex-col gap-1">
            <label className="text-[10px] font-mono text-[#94a3b8]/60">{l}</label>
            <input
              type="number"
              step={0.01}
              value={quaternion[key]}
              onChange={(e) => handleChange(key, e.target.value)}
              className="w-full rounded px-2 py-1 text-xs font-mono text-[#e2e8f0] outline-none"
              style={{
                backgroundColor: 'rgba(148,163,184,0.08)',
                border: '1px solid rgba(148,163,184,0.15)',
              }}
            />
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-[#94a3b8]/60">||q|| =</span>
          <span
            className="text-xs font-mono"
            style={{ color: isNormalized ? '#4ade80' : '#fbbf24' }}
          >
            {norm.toFixed(6)}
          </span>
        </div>
        {!isNormalized && (
          <button
            onClick={onNormalize}
            className="rounded px-2 py-0.5 text-[10px] font-mono transition-colors hover:opacity-80"
            style={{
              backgroundColor: 'rgba(251,191,36,0.15)',
              color: '#fbbf24',
              border: '1px solid rgba(251,191,36,0.3)',
            }}
          >
            归一化
          </button>
        )}
      </div>
    </div>
  );
}
