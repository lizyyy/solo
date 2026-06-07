import { FileText, MessageSquare } from 'lucide-react';
import type { EvidenceItem } from '../../types/claim';
import { SOURCE_LABELS } from '../../types/claim';

interface EvidenceCardProps {
  evidence: EvidenceItem;
}

const sourceConfig = {
  manual_judgment: { icon: FileText, bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100' },
  prompt_version: { icon: MessageSquare, bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', badge: 'bg-purple-100' },
};

export function EvidenceCard({ evidence }: EvidenceCardProps) {
  const config = sourceConfig[evidence.source];
  const Icon = config.icon;

  return (
    <div className={`p-4 rounded-lg border ${config.bg} ${config.border} transition-all hover:shadow-sm`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${config.badge} ${config.text}`}>
              <Icon size={12} />
              {SOURCE_LABELS[evidence.source]}
            </span>
            <span className="text-xs text-gray-500">{evidence.timestamp}</span>
          </div>
          <div className="text-sm font-medium text-gray-800 mb-1">{evidence.field}</div>
          <div className="text-sm text-gray-600 break-words">{evidence.value}</div>
          {evidence.remark && (
            <div className="mt-2 text-xs text-gray-500 bg-white/60 rounded px-2 py-1">
              备注：{evidence.remark}
            </div>
          )}
        </div>
      </div>
      <div className="mt-2 pt-2 border-t border-gray-200/50 text-xs text-gray-500">
        操作人：{evidence.operator}
      </div>
    </div>
  );
}
