import type { DogRecord } from '@/types';
import { Lightbulb, AlertTriangle, AlertOctagon, CheckCircle2, FileX, Scale } from 'lucide-react';
import { cn } from '@/lib/utils';
import { anomalyLabelMap } from '@/utils/dataUtils';

interface Props { record: DogRecord; }

const anomalyMeta = (tag: string) => {
  switch (tag) {
    case 'late_attachment': return { Icon: FileX, title: '晚到附件', color: 'anomaly' };
    case 'weight_unit_mixed': return { Icon: Scale, title: '体重单位混写', color: 'anomaly' };
    case 'fuzzy_attachment': return { Icon: AlertOctagon, title: '附件模糊', color: 'anomaly' };
    case 'conclusion_changed': return { Icon: AlertTriangle, title: '结论改判', color: 'verdict' };
    case 'manual_confirm': return { Icon: CheckCircle2, title: '人工确认', color: 'confirm' };
    default: return { Icon: AlertTriangle, title: tag, color: 'anomaly' as const };
  }
};

export default function AnomalyExplainPanel({ record }: Props) {
  const anomalies = record.versionHistory.filter(h => h.anomaly);
  if (anomalies.length === 0) {
    return (
      <div className="rounded-xl border border-brand-100 bg-brand-50/50 p-5 text-center text-sm text-brand-500">
        <CheckCircle2 className="w-6 h-6 mx-auto mb-2 text-emerald-500" />
        本报告全程无异常标注，一次通过。
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Lightbulb className="w-4 h-4 text-anomaly-500" />
        <h4 className="font-serif font-bold text-brand-800">异常说明 · 为什么没有按正常记录走</h4>
      </div>

      {anomalies.map(h => {
        const meta = anomalyMeta(h.anomaly!);
        const wrapperCls = cn(
          'rounded-xl border-2 p-4 relative overflow-hidden',
          meta.color === 'anomaly' && 'border-anomaly-200 bg-gradient-to-br from-anomaly-50 to-cream-50',
          meta.color === 'verdict' && 'border-verdict-200 bg-gradient-to-br from-verdict-50 to-pink-50/60',
          meta.color === 'confirm' && 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-brand-50',
        );
        const accentCls = cn(
          meta.color === 'anomaly' && 'text-anomaly-600 bg-anomaly-100',
          meta.color === 'verdict' && 'text-verdict-600 bg-verdict-100',
          meta.color === 'confirm' && 'text-emerald-700 bg-emerald-100',
        );
        return (
          <div key={h.version} className={wrapperCls}>
            <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-40"
              style={{
                background: meta.color === 'anomaly' ? 'radial-gradient(circle, rgba(245,158,11,0.35) 0%, transparent 70%)' :
                            meta.color === 'verdict' ? 'radial-gradient(circle, rgba(236,72,153,0.3) 0%, transparent 70%)' :
                            'radial-gradient(circle, rgba(16,185,129,0.3) 0%, transparent 70%)'
              }} />
            <div className="relative flex items-start gap-3">
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', accentCls)}>
                <meta.Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-mono font-bold text-brand-700 text-sm">版本 v{h.version}</span>
                  <span className={cn(
                    'chip',
                    meta.color === 'anomaly' && 'chip-anomaly',
                    meta.color === 'verdict' && 'chip-verdict',
                    meta.color === 'confirm' && 'chip-confirm',
                  )}>
                    {anomalyLabelMap[h.anomaly!] || h.anomaly}
                  </span>
                  <span className="text-[11px] text-brand-400">{h.timestamp} · {h.operator}</span>
                </div>
                {h.anomalyExplanation && (
                  <div className="text-sm text-brand-800 leading-relaxed mb-2">
                    {h.anomalyExplanation}
                  </div>
                )}
                {h.remark && (
                  <div className="text-xs text-brand-600 bg-white/70 rounded-lg px-3 py-2 border border-white/80">
                    <span className="font-semibold text-brand-700">操作备注：</span>{h.remark}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
