import { MessageSquare, User } from 'lucide-react';
import type { Remark } from '@/types';

interface RemarkTimelineProps {
  remarks: Remark[];
}

export default function RemarkTimeline({ remarks }: RemarkTimelineProps) {
  if (remarks.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">暂无备注</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-gray-200" />
      <div className="space-y-4">
        {remarks.map((remark) => (
          <div key={remark.id} className="relative pl-8">
            <div className="absolute left-0 top-1.5 w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center">
              <User className="w-3 h-3 text-primary-600" />
            </div>
            <div className="bg-gray-50 rounded p-3 border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-primary-700">{remark.operator}</span>
                <span className="text-xs text-gray-400">{remark.createdAt}</span>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {remark.content}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
