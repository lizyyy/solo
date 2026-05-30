import { useState } from 'react';
import { ChevronDown, ChevronRight, AlertTriangle, AlertCircle, FileText } from 'lucide-react';
import type { FittingRecord, AnomalyType } from '@/types';

const anomalyTypeMap: Record<AnomalyType, { label: string; color: string }> = {
  onset_misjudgment: { label: '起音点误判', color: 'bg-red-500/20 text-red-400 border border-red-500/30' },
  noise_interference: { label: '噪声干扰', color: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' },
  parameter_out_of_bounds: { label: '参数越界', color: 'bg-orange-500/20 text-orange-400 border border-orange-500/30' },
};

const anomalyIconMap: Record<AnomalyType, typeof AlertTriangle> = {
  onset_misjudgment: AlertTriangle,
  noise_interference: AlertCircle,
  parameter_out_of_bounds: AlertTriangle,
};

function formatADSR(params: { attack: number; decay: number; sustain: number; release: number }) {
  return `A:${params.attack.toFixed(2)} D:${params.decay.toFixed(2)} S:${params.sustain.toFixed(2)} R:${params.release.toFixed(2)}`;
}

function ADSRBreakdown({
  label,
  params,
  diff,
  highlight,
}: {
  label: string;
  params: { attack: number; decay: number; sustain: number; release: number };
  diff?: { attack: number; decay: number; sustain: number; release: number } | null;
  highlight?: boolean;
}) {
  const keys: (keyof typeof params)[] = ['attack', 'decay', 'sustain', 'release'];
  const labels = ['Attack', 'Decay', 'Sustain', 'Release'];

  return (
    <div className="space-y-1">
      <span className={`text-xs font-medium ${highlight ? 'text-synth-green' : 'text-gray-400'}`}>{label}</span>
      <div className="grid grid-cols-4 gap-3">
        {keys.map((key, i) => {
          const hasDiff = diff && diff[key] !== 0;
          return (
            <div key={key} className="text-center">
              <div className="text-[10px] text-gray-500">{labels[i]}</div>
              <div
                className={`font-mono-display text-sm font-semibold ${
                  highlight
                    ? 'text-synth-green'
                    : hasDiff
                    ? 'text-synth-amber'
                    : 'text-gray-300'
                }`}
              >
                {params[key].toFixed(3)}
              </div>
              {hasDiff && (
                <div className={`text-[10px] font-mono-display ${diff![key] > 0 ? 'text-red-400' : 'text-blue-400'}`}>
                  {diff![key] > 0 ? '+' : ''}{diff![key].toFixed(3)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ThreeLayerTable({
  records,
  anomalyFilter,
  onSelectRecord,
  onViewAudit,
  onViewNotes,
}: {
  records: FittingRecord[];
  anomalyFilter: string;
  onSelectRecord: (id: string) => void;
  onViewAudit: (id: string) => void;
  onViewNotes: (id: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = anomalyFilter === 'all'
    ? records
    : records.filter((r) => r.anomalies.some((a) => a.type === anomalyFilter));

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  function computeDiff(a: { attack: number; decay: number; sustain: number; release: number }, b: { attack: number; decay: number; sustain: number; release: number }) {
    return {
      attack: a.attack - b.attack,
      decay: a.decay - b.decay,
      sustain: a.sustain - b.sustain,
      release: a.release - b.release,
    };
  }

  return (
    <div className="rounded-xl border border-white/5 bg-synth-card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/5 text-gray-400 text-xs">
            <th className="px-4 py-3 text-left w-8"></th>
            <th className="px-4 py-3 text-left">时间</th>
            <th className="px-4 py-3 text-left">乐器标签</th>
            <th className="px-4 py-3 text-left">原始值</th>
            <th className="px-4 py-3 text-left">修正值</th>
            <th className="px-4 py-3 text-left">结论值</th>
            <th className="px-4 py-3 text-left">异常标记</th>
            <th className="px-4 py-3 text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((record) => {
            const isExpanded = expandedId === record.id;
            const Icon = isExpanded ? ChevronDown : ChevronRight;

            return (
              <tr key={record.id} className="group border-b border-white/5 last:border-b-0">
                <td colSpan={8} className="p-0">
                  <div
                    className={`cursor-pointer transition-colors hover:bg-white/[0.02] ${
                      isExpanded ? 'bg-synth-selected/30' : ''
                    }`}
                    onClick={() => {
                      toggleExpand(record.id);
                      onSelectRecord(record.id);
                    }}
                  >
                    <div className="flex items-center">
                      <div className="px-4 py-3 w-8">
                        <Icon size={14} className="text-gray-500" />
                      </div>
                      <div className="px-4 py-3 font-mono-display text-xs text-gray-400 w-44 shrink-0">
                        {new Date(record.createdAt).toLocaleString('zh-CN', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                      <div className="px-4 py-3 w-28 shrink-0">
                        <span className="rounded-md bg-synth-selected px-2 py-0.5 text-xs text-purple-300 font-mono-display">
                          {record.instrumentLabel}
                        </span>
                      </div>
                      <div className="px-4 py-3 font-mono-display text-xs text-gray-500 w-56 shrink-0">
                        {formatADSR(record.raw)}
                      </div>
                      <div className="px-4 py-3 font-mono-display text-xs w-56 shrink-0">
                        {record.corrected ? (
                          <span className="text-synth-amber">{formatADSR(record.corrected)}</span>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </div>
                      <div className="px-4 py-3 font-mono-display text-xs text-synth-green w-56 shrink-0">
                        {formatADSR(record.conclusion)}
                      </div>
                      <div className="px-4 py-3 flex-1">
                        <div className="flex flex-wrap gap-1">
                          {record.anomalies.map((anomaly) => {
                            const config = anomalyTypeMap[anomaly.type];
                            const AnomalyIcon = anomalyIconMap[anomaly.type];
                            return (
                              <span
                                key={anomaly.id}
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${config.color}`}
                              >
                                <AnomalyIcon size={10} />
                                {config.label}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                      <div className="px-4 py-3 flex items-center gap-2 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewAudit(record.id);
                          }}
                          className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-gray-300 hover:border-synth-green/50 hover:text-synth-green transition-colors"
                        >
                          <FileText size={10} className="inline mr-1" />
                          查看审计
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewNotes(record.id);
                          }}
                          className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-gray-300 hover:border-synth-amber/50 hover:text-synth-amber transition-colors"
                        >
                          <FileText size={10} className="inline mr-1" />
                          查看备注
                        </button>
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="bg-synth-bg/60 px-6 py-4 border-t border-white/5">
                      <div className="grid grid-cols-3 gap-6">
                        <ADSRBreakdown label="原始值 (Raw)" params={record.raw} />
                        <ADSRBreakdown
                          label="修正值 (Corrected)"
                          params={record.corrected || record.raw}
                          diff={record.corrected ? computeDiff(record.corrected, record.raw) : null}
                        />
                        <ADSRBreakdown
                          label="结论值 (Conclusion)"
                          params={record.conclusion}
                          highlight
                          diff={computeDiff(record.conclusion, record.raw)}
                        />
                      </div>
                      {record.anomalies.length > 0 && (
                        <div className="mt-4 border-t border-white/5 pt-3">
                          <span className="text-xs text-gray-500 mb-2 block">异常详情</span>
                          <div className="space-y-1">
                            {record.anomalies.map((anomaly) => (
                              <div key={anomaly.id} className="flex items-center gap-2 text-xs">
                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${anomalyTypeMap[anomaly.type].color}`}>
                                  {anomalyTypeMap[anomaly.type].label}
                                </span>
                                <span className="text-gray-400">{anomaly.description}</span>
                                <span className="text-gray-600 ml-auto">受影响参数: {anomaly.affectedParam}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                暂无数据
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
