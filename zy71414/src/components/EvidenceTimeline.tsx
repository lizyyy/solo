import {
  RefreshCw,
  Edit3,
  Paperclip,
  MessageSquare,
  CreditCard,
} from 'lucide-react';
import type { EvidenceItem } from '../types';
import { EVIDENCE_TYPE_LABELS } from '../types';
import { formatDateTime } from '../utils/format';

interface EvidenceTimelineProps {
  items: EvidenceItem[];
}

export function EvidenceTimeline({ items }: EvidenceTimelineProps) {
  const getTypeIcon = (type: EvidenceItem['type']) => {
    switch (type) {
      case 'STATUS_CHANGE':
        return <RefreshCw size={16} className="text-blue-500" />;
      case 'FIELD_CHANGE':
        return <Edit3 size={16} className="text-amber-500" />;
      case 'ATTACHMENT':
        return <Paperclip size={16} className="text-purple-500" />;
      case 'COMMENT':
        return <MessageSquare size={16} className="text-gray-500" />;
      case 'PAYMENT':
        return <CreditCard size={16} className="text-success-500" />;
      default:
        return <MessageSquare size={16} className="text-gray-400" />;
    }
  };

  const getTypeBg = (type: EvidenceItem['type']) => {
    switch (type) {
      case 'STATUS_CHANGE':
        return 'bg-blue-50';
      case 'FIELD_CHANGE':
        return 'bg-amber-50';
      case 'ATTACHMENT':
        return 'bg-purple-50';
      case 'COMMENT':
        return 'bg-gray-50';
      case 'PAYMENT':
        return 'bg-success-50';
      default:
        return 'bg-gray-50';
    }
  };

  if (items.length === 0) {
    return <p className="text-gray-500 text-sm">暂无证据链记录</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div
          key={item.id}
          className={`p-3 rounded-lg border ${getTypeBg(item.type)} border-gray-100`}
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5">{getTypeIcon(item.type)}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-gray-500 bg-white px-2 py-0.5 rounded">
                  {EVIDENCE_TYPE_LABELS[item.type]}
                </span>
                <span className="text-xs text-gray-400">
                  {item.operator} · {formatDateTime(item.timestamp)}
                </span>
              </div>
              <p className="text-sm text-gray-700">{item.content}</p>
              {item.metadata && Object.keys(item.metadata).length > 0 && (
                <div className="mt-2 text-xs text-gray-500 bg-white/60 p-2 rounded">
                  {Object.entries(item.metadata).map(([key, value]) => (
                    <div key={key} className="flex gap-2">
                      <span className="font-medium">{key}:</span>
                      <span>{JSON.stringify(value)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
