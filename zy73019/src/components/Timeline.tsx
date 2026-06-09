import { STATUS_LABEL, type TimelineNode } from '../../shared/types';
import StatusBadge from './StatusBadge';
import { PlusCircle, Edit3, Upload, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimelineProps {
  nodes: TimelineNode[];
}

const nodeConfig = {
  create: {
    icon: PlusCircle,
    color: 'bg-sage border-sage',
    lineColor: 'bg-sage/40',
  },
  revise: {
    icon: Edit3,
    color: 'bg-ochre border-ochre',
    lineColor: 'bg-ochre/40',
  },
  upload: {
    icon: Upload,
    color: 'bg-sand border-sand',
    lineColor: 'bg-sand/40',
  },
};

const Timeline = ({ nodes }: TimelineProps) => {
  if (!nodes || nodes.length === 0) {
    return (
      <div className="py-12 text-center text-slate-stone bg-cream/50 rounded-xl border border-dashed border-sand/30">
        暂无处理记录
      </div>
    );
  }

  return (
    <div className="relative">
      {nodes.map((node, idx) => {
        const config = nodeConfig[node.type];
        const Icon = config.icon;
        const isLast = idx === nodes.length - 1;

        return (
          <div key={node.id} className="relative flex gap-4">
            {!isLast && (
              <div
                className={cn(
                  'absolute left-[19px] top-10 bottom-[-24px] w-0.5',
                  config.lineColor
                )}
              />
            )}

            <div
              className={cn(
                'relative z-10 flex-shrink-0 w-10 h-10 rounded-full border-4 border-white flex items-center justify-center text-white shadow-sm',
                config.color
              )}
            >
              <Icon className="w-4.5 h-4.5" />
            </div>

            <div className="flex-1 pb-6">
              <div className="bg-white rounded-xl border border-sand/30 p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <h4 className="font-semibold text-slate-stone-dark">{node.title}</h4>
                    <p className="text-xs text-slate-stone mt-0.5">
                      {node.operator} · {new Date(node.timestamp).toLocaleString('zh-CN')}
                    </p>
                  </div>
                  {node.type === 'revise' && node.details.statusChange && (
                    <div className="flex items-center gap-2 text-xs">
                      {node.details.statusChange.old && (
                        <StatusBadge status={node.details.statusChange.old} />
                      )}
                      <span className="text-slate-stone">→</span>
                      <StatusBadge status={node.details.statusChange.new} />
                    </div>
                  )}
                </div>

                {node.summary && (
                  <p className="text-sm text-slate-stone mb-2">{node.summary}</p>
                )}

                {node.details.reviseReason && (
                  <div className="mb-2 p-2.5 rounded-lg bg-ochre/10 border border-ochre/20">
                    <p className="text-xs text-ochre-dark font-medium mb-0.5">改判原因</p>
                    <p className="text-sm text-ochre-dark/80">{node.details.reviseReason}</p>
                  </div>
                )}

                {node.details.note && (
                  <div className="mb-2 p-2.5 rounded-lg bg-sand/10 border border-sand/20">
                    <p className="text-xs text-sand-dark font-medium mb-0.5">备注</p>
                    <p className="text-sm text-slate-stone">{node.details.note}</p>
                  </div>
                )}

                {node.details.materials && node.details.materials.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-sand/20">
                    {node.details.materials.map((mat) => (
                      <div key={mat.id} className="flex items-center gap-2 text-xs">
                        <FileText className="w-3.5 h-3.5 text-sand" />
                        <span className="text-slate-stone truncate">{mat.name}</span>
                        <span className="flex-shrink-0 text-slate-stone">v{mat.version}</span>
                        {mat.changed && (
                          <span className="flex-shrink-0 px-1.5 py-0.5 rounded bg-brick/10 text-brick-dark text-[10px] font-medium">
                            一致性变更
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default Timeline;
