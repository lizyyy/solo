import type { InfluenceTraceItem } from '../../shared/types.js';
import { FileWarning, MessageCircle, Trash2, CheckCircle2, XCircle } from 'lucide-react';

interface Props {
  items: InfluenceTraceItem[];
}

const typeCfg: Record<InfluenceTraceItem['type'], {
  title: string;
  Icon: any;
  color: string;
  bar: string;
}> = {
  weightVersion: {
    title: '体重曲线版本更新',
    Icon: FileWarning,
    color: 'text-brand-600',
    bar: 'bg-brand-500',
  },
  withdrawnRecord: {
    title: '撤回记录',
    Icon: Trash2,
    color: 'text-ink-500',
    bar: 'bg-ink-300',
  },
  verbalNote: {
    title: '口头备注',
    Icon: MessageCircle,
    color: 'text-accent-500',
    bar: 'bg-accent-400',
  },
};

export function InfluenceTimeline({ items }: Props) {
  const sorted = [...items].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const affectsCount = sorted.filter(i => i.affectsConclusion).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-ink-700 text-sm">影响结论追踪</span>
          <span className="chip bg-warn-500/10 text-warn-600">
            影响结论 {affectsCount} 项
          </span>
          <span className="chip bg-ink-100 text-ink-500">
            不影响 {sorted.length - affectsCount} 项
          </span>
        </div>
      </div>

      <div className="relative pl-4">
        <div className="absolute left-[7px] top-0 bottom-0 w-0.5 bg-gradient-to-b from-brand-300 via-accent-300 to-ink-200 rounded-full" />

        <div className="space-y-5 stagger">
          {sorted.map(item => {
            const cfg = typeCfg[item.type];
            const Icon = cfg.Icon;
            return (
              <div key={item.id} className="relative group">
                <div className={`absolute -left-[5px] top-1 w-5 h-5 rounded-full ${cfg.bar} text-white flex items-center justify-center ring-4 ring-white shadow-sm`}>
                  <Icon size={10} />
                </div>

                <div className={`ml-6 rounded-xl p-3.5 border transition-all duration-200
                  ${item.affectsConclusion
                    ? 'bg-warn-500/5 border-warn-400/30 group-hover:bg-warn-500/10'
                    : 'bg-ink-50/60 border-ink-200 group-hover:bg-ink-100/60'
                  }`}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold ${cfg.color}`}>
                        {cfg.title}
                      </span>
                      {item.affectsConclusion ? (
                        <span className="chip bg-warn-500/15 text-warn-600 text-[11px]">
                          <XCircle size={11} /> 影响结论
                        </span>
                      ) : (
                        <span className="chip bg-brand-100 text-brand-700 text-[11px]">
                          <CheckCircle2 size={11} /> 不影响结论
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-ink-300 whitespace-nowrap">
                      {item.timestamp.replace('T', ' ').slice(0, 16)}
                    </span>
                  </div>

                  <p className={`text-sm leading-relaxed ${
                    item.type === 'withdrawnRecord' ? 'line-through text-ink-300 decoration-warn-400/70 decoration-2' : 'text-ink-700'
                  }`}>
                    {item.content}
                  </p>

                  <div className="mt-2 flex items-center gap-2 text-[11px] text-ink-500">
                    <span className="font-medium">操作人：{item.operator}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
