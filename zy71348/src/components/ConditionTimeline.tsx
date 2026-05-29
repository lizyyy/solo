import { useRecordStore } from '@/store/useRecordStore';
import { ConditionBadge } from './ConditionBadge';
import { Clock, User, MessageSquare } from 'lucide-react';

interface ConditionTimelineProps {
  recordId: string;
}

export function ConditionTimeline({ recordId }: ConditionTimelineProps) {
  const history = useRecordStore((s) => s.getConditionHistory(recordId));

  if (history.length === 0) {
    return (
      <div className="text-center py-6 text-vinyl-500 text-sm">
        暂无品相变更记录
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-vinyl-700/20" />
      <div className="space-y-4">
        {history.map((item, idx) => (
          <div key={item.id} className="relative pl-10 animate-fade-in" style={{ animationDelay: `${idx * 50}ms` }}>
            <div className="absolute left-2 top-1 w-5 h-5 rounded-full bg-vinyl-700 border-2 border-cream-100 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-caramel-400" />
            </div>
            <div className="card">
              <div className="flex items-center gap-3 mb-2">
                <ConditionBadge condition={item.fromCondition} />
                <span className="text-vinyl-400">→</span>
                <ConditionBadge condition={item.toCondition} />
              </div>
              <div className="text-sm text-vinyl-700 space-y-1">
                <div className="flex items-center gap-1.5 text-vinyl-600">
                  <User className="w-3.5 h-3.5" />
                  <span>{item.operator}</span>
                </div>
                <div className="flex items-center gap-1.5 text-vinyl-600">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{new Date(item.timestamp).toLocaleString('zh-CN')}</span>
                </div>
                {item.reason && (
                  <div className="flex items-start gap-1.5 text-vinyl-700 mt-2 pt-2 border-t border-vinyl-700/10">
                    <MessageSquare className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    <span>{item.reason}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
