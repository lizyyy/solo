import type { ValidationResult } from '@/types';

interface ValidationOverlayProps {
  results: ValidationResult[];
}

export default function ValidationOverlay({ results }: ValidationOverlayProps) {
  if (results.length === 0) return null;

  const pending = results.filter((r) => r.pendingConfirmation);
  if (pending.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      {pending.map((result, i) => {
        const isError = result.severity === 'error';
        const color = isError ? '#ef4444' : '#fbbf24';
        const bgColor = isError ? 'rgba(239,68,68,0.1)' : 'rgba(251,191,36,0.1)';
        const borderColor = isError ? 'rgba(239,68,68,0.3)' : 'rgba(251,191,36,0.3)';

        return (
          <div
            key={`${result.type}-${i}`}
            className="rounded-md px-3 py-2"
            style={{
              backgroundColor: bgColor,
              border: `1px solid ${borderColor}`,
            }}
          >
            <div className="flex items-center gap-2">
              <span style={{ color }}>
                ⚠
              </span>
              <span
                className="text-[10px] font-mono font-semibold"
                style={{ color }}
              >
                待确认
              </span>
            </div>
            <p className="mt-0.5 text-[10px] font-mono text-[#94a3b8] leading-relaxed">
              {result.message}
            </p>
          </div>
        );
      })}
    </div>
  );
}
