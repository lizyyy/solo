import { FileText, MessageSquare, Settings, User } from 'lucide-react';
import type { TimelineNode } from '../../types/claim';
import { SOURCE_LABELS } from '../../types/claim';

interface EvidenceTimelineProps {
  timeline: TimelineNode[];
}

const sourceIcons = {
  manual_judgment: FileText,
  prompt_version: MessageSquare,
};

export function EvidenceTimeline({ timeline }: EvidenceTimelineProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-800 mb-4">证据时间线</h3>
      <div className="relative">
        <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-gray-200" />
        <div className="space-y-4">
          {timeline.map((node, idx) => {
            const isLast = idx === timeline.length - 1;
            const hasSource = !!node.source;
            const Icon = hasSource ? sourceIcons[node.source!] : node.operator === '系统' ? Settings : User;
            const dotColor = hasSource
              ? node.source === 'manual_judgment'
                ? 'bg-blue-500'
                : 'bg-purple-500'
              : node.operator === '系统'
                ? 'bg-gray-500'
                : 'bg-emerald-500';

            return (
              <div key={node.id} className="relative flex gap-4 pl-10">
                <div
                  className={`absolute left-0 top-0.5 w-8 h-8 rounded-full ${dotColor} flex items-center justify-center text-white shadow-sm z-10`}
                >
                  <Icon size={14} />
                </div>
                <div className={`flex-1 pb-4 ${isLast ? '' : ''}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-800">{node.action}</span>
                    {hasSource && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                        {SOURCE_LABELS[node.source!]}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-600 mb-1">{node.description}</div>
                  <div className="text-xs text-gray-400">
                    {node.timestamp} · {node.operator}
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
