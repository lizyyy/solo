import { CheckCircle2, Clock, FileText, ShieldCheck, Archive } from 'lucide-react';
import type { ProcessNode, ProcessStep } from '@shared/types';
import { ROLE_LABELS } from '@shared/types';

interface ProcessTimelineProps {
  nodes: ProcessNode[];
}

const stepConfig: Record<ProcessStep, { icon: typeof CheckCircle2; label: string; color: string }> = {
  import: { icon: FileText, label: '数据导入', color: 'text-custody-blue' },
  custody: { icon: FileText, label: '托管确认', color: 'text-custody-blue' },
  review: { icon: ShieldCheck, label: '风控复核', color: 'text-warning-orange' },
  complete: { icon: Archive, label: '完成归档', color: 'text-finance-green' },
};

export default function ProcessTimeline({ nodes }: ProcessTimelineProps) {
  if (nodes.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>暂无流程记录</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-carbon-200" />
      <div className="space-y-6">
        {nodes.map((node, index) => {
          const config = stepConfig[node.step];
          const Icon = config.icon;
          const isLast = index === nodes.length - 1;

          return (
            <div key={node.id} className="relative flex gap-4 animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
              <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center ${
                isLast ? 'bg-carbon-500 text-white' : 'bg-white border-2 border-carbon-200'
              }`}>
                <Icon className={`w-4 h-4 ${isLast ? 'text-white' : config.color}`} />
              </div>
              <div className="flex-1 pb-6">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-carbon-800">{config.label}</span>
                  <span className="text-xs text-carbon-400">
                    {node.timestamp}
                  </span>
                </div>
                <p className="text-sm text-carbon-600 mb-1">{node.action}</p>
                {node.comment && (
                  <p className="text-sm text-carbon-500 bg-carbon-50 rounded px-3 py-2 mt-2 border-l-2 border-custody-blue">
                    <span className="font-medium">备注：</span>{node.comment}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs px-2 py-0.5 bg-carbon-100 text-carbon-500 rounded">
                    {node.operator}
                  </span>
                  <span className="text-xs text-carbon-400">
                    {ROLE_LABELS[node.operatorRole]}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
