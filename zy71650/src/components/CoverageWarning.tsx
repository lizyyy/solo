import { useState } from 'react';
import { AlertTriangle, ShieldCheck, Eye } from 'lucide-react';
import type { CoverageWarning, FittingRecord } from '@/types';

interface CoverageWarningProps {
  warnings: CoverageWarning[];
  allRecords: FittingRecord[];
}

export default function CoverageWarningBanner({ warnings, allRecords }: CoverageWarningProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (warnings.length === 0) {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-synth-green/20 bg-synth-green/5">
        <ShieldCheck className="w-4 h-4 text-synth-green shrink-0" />
        <span className="text-xs font-mono text-synth-green">所有结论均为最新</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {warnings.map((w) => {
        const oldRecord = allRecords.find((r) => r.id === w.oldRecordId);
        const isExpanded = expandedId === w.oldRecordId;

        return (
          <div
            key={w.oldRecordId}
            className="rounded-xl border border-synth-amber/30 bg-synth-amber/5 overflow-hidden"
          >
            <div className="flex items-start gap-2 px-4 py-2.5">
              <AlertTriangle className="w-4 h-4 text-synth-amber shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-synth-amber font-mono">
                  记录 {w.oldRecordId.slice(0, 6)}... 的{' '}
                  {w.coveredParams.join(', ')} 参数已被新拟合覆盖
                </p>
                <p className="text-[10px] text-synth-amber/60 mt-0.5">{w.message}</p>
              </div>
              {oldRecord && (
                <button
                  onClick={() => setExpandedId(isExpanded ? null : w.oldRecordId)}
                  className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-synth-amber hover:bg-synth-amber/10 transition-colors shrink-0"
                >
                  <Eye className="w-3 h-3" />
                  查看旧结论
                </button>
              )}
            </div>

            {isExpanded && oldRecord && (
              <div className="px-4 py-3 border-t border-synth-amber/10 bg-synth-bg/50">
                <p className="text-[10px] text-synth-muted mb-2 font-mono">旧结论快照：</p>
                <div className="grid grid-cols-4 gap-2">
                  {(['attack', 'decay', 'sustain', 'release'] as const).map((param) => (
                    <div key={param} className="rounded-lg bg-synth-card px-2 py-1.5 text-center">
                      <div className="text-[10px] text-synth-muted uppercase">{param}</div>
                      <div className="text-xs font-mono text-gray-300">
                        {param === 'sustain'
                          ? `${(oldRecord.conclusion[param] * 100).toFixed(1)}%`
                          : `${oldRecord.conclusion[param].toFixed(2)}ms`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
