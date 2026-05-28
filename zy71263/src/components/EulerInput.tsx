import type { EulerAngles } from '@/types';
import { isGimbalLock } from '@/utils/euler';
import DataTag from './DataTag';

interface EulerInputProps {
  euler: EulerAngles;
  onChange: (e: EulerAngles) => void;
}

const SEQUENCES: EulerAngles['sequence'][] = ['ZYX', 'ZYZ', 'XYZ'];

export default function EulerInput({ euler, onChange }: EulerInputProps) {
  const gimbalLock = isGimbalLock(euler);

  const handleChange = (key: keyof Pick<EulerAngles, 'roll' | 'pitch' | 'yaw'>, value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return;
    onChange({ ...euler, [key]: num });
  };

  const handleSequenceChange = (sequence: EulerAngles['sequence']) => {
    onChange({ ...euler, sequence });
  };

  const toDeg = (rad: number) => ((rad * 180) / Math.PI).toFixed(1);

  const axes: { key: keyof Pick<EulerAngles, 'roll' | 'pitch' | 'yaw'>; label: string }[] = [
    { key: 'roll', label: 'Roll' },
    { key: 'pitch', label: 'Pitch' },
    { key: 'yaw', label: 'Yaw' },
  ];

  return (
    <div
      className="rounded-lg p-3"
      style={{
        backgroundColor: 'rgba(10,14,39,0.8)',
        border: gimbalLock ? '1px solid rgba(239,68,68,0.5)' : '1px solid rgba(148,163,184,0.15)',
      }}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-sm text-[#94a3b8]">欧拉角</span>
        <div className="flex items-center gap-2">
          {gimbalLock && (
            <span className="animate-pulse text-[10px] font-mono text-red-400">⚠ 万向节锁</span>
          )}
          <DataTag tag={euler.source} />
        </div>
      </div>

      <div className="mb-2">
        <select
          value={euler.sequence}
          onChange={(e) => handleSequenceChange(e.target.value as EulerAngles['sequence'])}
          className="rounded px-2 py-1 text-xs font-mono text-[#e2e8f0] outline-none"
          style={{
            backgroundColor: 'rgba(148,163,184,0.08)',
            border: '1px solid rgba(148,163,184,0.15)',
          }}
        >
          {SEQUENCES.map((seq) => (
            <option key={seq} value={seq} style={{ backgroundColor: '#0a0e27' }}>
              {seq}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        {axes.map(({ key, label }) => (
          <div key={key}>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10px] font-mono text-[#94a3b8]/60">{label}</span>
              <span className="text-[10px] font-mono text-[#94a3b8]/50">{toDeg(euler[key])}°</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={-Math.PI}
                max={Math.PI}
                step={0.01}
                value={euler[key]}
                onChange={(e) => handleChange(key, e.target.value)}
                className="h-1 flex-1 cursor-pointer appearance-none rounded-full"
                style={{
                  backgroundColor: 'rgba(148,163,184,0.2)',
                  accentColor: '#00e5c7',
                }}
              />
              <input
                type="number"
                min={-Math.PI}
                max={Math.PI}
                step={0.01}
                value={euler[key]}
                onChange={(e) => handleChange(key, e.target.value)}
                className="w-16 rounded px-1 py-0.5 text-[10px] font-mono text-[#e2e8f0] outline-none"
                style={{
                  backgroundColor: 'rgba(148,163,184,0.08)',
                  border: '1px solid rgba(148,163,184,0.15)',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
