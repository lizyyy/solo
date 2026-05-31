import { useState } from 'react';
import { Beaker, Play, History, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import type { ViscosityEstimate } from '@shared/types';
import { useLabStore } from '@/store/useLabStore';
import { formatDateTime, getJudgmentLabel } from '@/lib/api';

interface ViscosityPanelProps {
  batchId: string;
}

const judgmentTagClass = {
  pass: 'tag-pass',
  fail: 'tag-fail',
  borderline: 'tag-borderline',
  insufficient_data: 'tag-insufficient',
};

export function ViscosityPanel({ batchId }: ViscosityPanelProps) {
  const [showHistory, setShowHistory] = useState(false);

  const viscosityHistory = useLabStore((state) => state.viscosityHistory);
  const loading = useLabStore((state) => state.loading.viscosity);
  const runViscosityEstimate = useLabStore((state) => state.runViscosityEstimate);
  const fetchViscosityHistory = useLabStore((state) => state.fetchViscosityHistory);

  const latestEstimate = viscosityHistory.length > 0
    ? viscosityHistory[viscosityHistory.length - 1]
    : null;

  const handleRunEstimate = async () => {
    await runViscosityEstimate(batchId);
  };

  return (
    <div className="card">
      <div className="p-4 border-b border-ink-200">
        <div className="flex items-center justify-between">
          <h3 className="section-title mb-0 border-none flex items-center gap-2">
            <Beaker size={16} className="text-brick-600" />
            液体黏度估计
          </h3>
          <button
            onClick={handleRunEstimate}
            disabled={loading}
            className="btn btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
          >
            <Play size={12} />
            {loading ? '计算中...' : viscosityHistory.length > 0 ? '重新估计' : '执行估计'}
          </button>
        </div>
      </div>

      <div className="p-4">
        {loading && !latestEstimate ? (
          <div className="animate-pulse-soft space-y-3">
            <div className="h-12 bg-ink-100 rounded" />
            <div className="h-4 bg-ink-100 rounded w-full" />
            <div className="h-4 bg-ink-100 rounded w-3/4" />
          </div>
        ) : latestEstimate ? (
          <ViscosityResult estimate={latestEstimate} />
        ) : (
          <div className="text-center py-6">
            <AlertTriangle size={24} className="mx-auto text-amber-500 mb-2" />
            <p className="text-sm text-ink-500">尚未执行黏度估计</p>
            <p className="text-xs text-ink-400 mt-1">点击上方按钮开始计算</p>
          </div>
        )}

        {viscosityHistory.length > 1 && (
          <div className="mt-4 pt-4 border-t border-ink-100">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-2 text-sm text-ink-500 hover:text-ink-700 transition-colors"
            >
              <History size={14} />
              历史记录 ({viscosityHistory.length})
              {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showHistory && (
              <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
                {viscosityHistory.slice(0, -1).reverse().map((estimate, idx) => (
                  <div
                    key={estimate.id}
                    className="p-2 bg-ink-50 border border-ink-100 text-xs"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-ink-400">#{viscosityHistory.length - idx - 1}</span>
                      <span className={`tag ${judgmentTagClass[estimate.judgment]}`}>
                        {getJudgmentLabel(estimate.judgment)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-ink-700">
                        {estimate.viscosity !== null ? estimate.viscosity.toFixed(4) : '—'} {estimate.unit}
                      </span>
                      <span className="text-ink-400">{formatDateTime(estimate.timestamp)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ViscosityResult({ estimate }: { estimate: ViscosityEstimate }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <div className="text-center">
          <div className="font-serif text-3xl font-semibold text-ink-800">
            {estimate.viscosity !== null ? estimate.viscosity.toFixed(4) : '—'}
          </div>
          <div className="text-xs text-ink-400">{estimate.unit}</div>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`tag ${judgmentTagClass[estimate.judgment]}`}>
              {getJudgmentLabel(estimate.judgment)}
            </span>
            <span className="text-xs text-ink-400 font-mono">v{estimate.algorithmVersion}</span>
          </div>
          <p className="text-sm text-ink-600 leading-relaxed">{estimate.judgmentReason}</p>
        </div>
      </div>

      {estimate.nextSteps.length > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200">
          <h5 className="font-serif text-sm text-amber-800 mb-2">下一步建议</h5>
          <ul className="space-y-1">
            {estimate.nextSteps.map((step, idx) => (
              <li key={idx} className="text-xs text-amber-700 flex items-start gap-2">
                <span className="text-amber-500 flex-shrink-0">{idx + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
