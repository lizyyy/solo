import type { DogRecord } from '@/types';
import { anomalyLabelMap } from '@/utils/dataUtils';
import { Clock, User, AlertTriangle, CheckCheck, AlertOctagon, ArrowRightLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  record: DogRecord;
  selectedA: number;
  selectedB: number;
  onSelect: (v: number) => void;
  onToggleCompare: (v: number) => void;
}

export default function VersionTimeline({ record, selectedA, selectedB, onSelect, onToggleCompare }: Props) {
  const hist = record.versionHistory;

  const anomalyColor = (tag?: string) => {
    switch (tag) {
      case 'late_attachment': return { ring: 'ring-anomaly-400', bg: 'bg-anomaly-500', fill: 'text-anomaly-600' };
      case 'weight_unit_mixed': return { ring: 'ring-anomaly-400', bg: 'bg-anomaly-500', fill: 'text-anomaly-600' };
      case 'fuzzy_attachment': return { ring: 'ring-anomaly-400', bg: 'bg-anomaly-500', fill: 'text-anomaly-600' };
      case 'conclusion_changed': return { ring: 'ring-verdict-400', bg: 'bg-verdict-500', fill: 'text-verdict-600' };
      case 'manual_confirm': return { ring: 'ring-emerald-400', bg: 'bg-emerald-500', fill: 'text-emerald-600' };
      default: return { ring: 'ring-brand-300', bg: 'bg-brand-500', fill: 'text-brand-500' };
    }
  };

  const AnomalyIcon = ({ tag }: { tag?: string }) => {
    if (tag === 'manual_confirm') return <CheckCheck className="w-3 h-3 text-white" />;
    if (tag === 'conclusion_changed') return <ArrowRightLeft className="w-3 h-3 text-white" />;
    if (tag) return <AlertTriangle className="w-3 h-3 text-white" />;
    return null;
  };

  return (
    <div className="relative pl-2">
      <div className="absolute left-5 top-2 bottom-2 w-0.5 bg-gradient-to-b from-brand-200 via-brand-100 to-brand-50" />

      <div className="space-y-4">
        {hist.map((h, idx) => {
          const c = anomalyColor(h.anomaly);
          const isCurrent = idx === hist.length - 1;
          const isA = selectedA === h.version;
          const isB = selectedB === h.version;
          const isAny = isA || isB;

          return (
            <div key={h.version} className="relative pl-10">
              <div
                className={cn(
                  'timeline-dot absolute left-3 top-3 z-10',
                  isCurrent ? c.bg : 'bg-white',
                  isAny ? `ring-4 ${c.ring} scale-125` : '',
                  isCurrent ? 'border-white' : `border-${c.bg.replace('bg-', '')}`
                )}
                style={!isCurrent ? { borderColor: 'currentColor' } : undefined}
              >
                {h.anomaly && <AnomalyIcon tag={h.anomaly} />}
              </div>

              <div
                onClick={() => onSelect(h.version)}
                onDoubleClick={() => onToggleCompare(h.version)}
                className={cn(
                  'cursor-pointer rounded-xl border p-3 transition-all',
                  isAny
                    ? 'bg-white border-brand-300 shadow-card-hover'
                    : 'bg-white/60 border-brand-100 hover:bg-white hover:border-brand-200'
                )}
              >
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-brand-700 text-sm">
                        v{h.version}
                        {isCurrent && <span className="ml-1 chip chip-normal text-[10px]">当前</span>}
                      </span>
                      {h.anomaly && (
                        <span className={`chip chip-${h.anomaly === 'manual_confirm' ? 'confirm' : h.anomaly === 'conclusion_changed' ? 'verdict' : 'anomaly'}`}>
                          {anomalyLabelMap[h.anomaly] || h.anomaly}
                        </span>
                      )}
                      {isA && <span className="chip chip-normal">对比 A</span>}
                      {isB && <span className="chip chip-supplement">对比 B</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-brand-500">
                      <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{h.timestamp}</span>
                      <span className="inline-flex items-center gap-1"><User className="w-3 h-3" />{h.operator}</span>
                    </div>
                  </div>
                  <div className={`text-xs font-semibold ${
                    h.snapshot.conclusion === '疫苗合格 可寄养' ? 'text-emerald-600' :
                    h.snapshot.conclusion === '待审核' ? 'text-anomaly-500' :
                    'text-verdict-600'
                  }`}>
                    {h.snapshot.conclusion}
                  </div>
                </div>
                {h.remark && (
                  <div className="mt-2 text-xs text-brand-700 bg-brand-50/60 rounded-lg px-3 py-2 border border-brand-50 leading-relaxed">
                    {h.remark}
                  </div>
                )}
                <div className="mt-2 text-[11px] text-brand-400 italic">
                  单击查看快照 · 双击加入对比（可与另一版本差异对比）
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
