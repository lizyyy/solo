import { ChevronDown, ChevronRight, User, Clock } from 'lucide-react';
import { useState } from 'react';
import type { JudgmentHistory as JudgmentHistoryType } from '../../types';
import { formatDate } from '../../utils/fileParser';
import { StatusBadge } from '../common/StatusBadge';

interface JudgmentHistoryProps {
  judgments: JudgmentHistoryType[];
}

export const JudgmentHistory = ({ judgments }: JudgmentHistoryProps) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (judgments.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        暂无人工改判记录
      </div>
    );
  }

  const sortedJudgments = [...judgments].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="space-y-3">
      {sortedJudgments.map((judgment) => {
        const isExpanded = expandedId === judgment.id;
        
        return (
          <div 
            key={judgment.id} 
            className="border border-gray-200 rounded-sm overflow-hidden"
          >
            <div 
              className="flex items-center justify-between p-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => setExpandedId(isExpanded ? null : judgment.id)}
            >
              <div className="flex items-center gap-3">
                {isExpanded ? <ChevronDown size={16} className="text-gray-500" /> : <ChevronRight size={16} className="text-gray-500" />}
                <div className="flex items-center gap-2">
                  <StatusBadge status={judgment.oldStatus} />
                  <span className="text-gray-400">→</span>
                  <StatusBadge status={judgment.newStatus} />
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <div className="flex items-center gap-1">
                  <User size={12} />
                  {judgment.operator}
                </div>
                <div className="flex items-center gap-1">
                  <Clock size={12} />
                  {formatDate(judgment.createdAt)}
                </div>
              </div>
            </div>
            
            {isExpanded && (
              <div className="p-3 border-t border-gray-200 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-3 rounded-sm border border-gray-200">
                    <p className="text-xs text-gray-500 mb-1 font-medium">改判前理由（旧）</p>
                    <p className="text-sm text-gray-500 italic line-through">
                      {judgment.oldRemark || '无'}
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                      状态：<StatusBadge status={judgment.oldStatus} />
                    </p>
                  </div>
                  <div className="bg-green-50 p-3 rounded-sm border border-green-200">
                    <p className="text-xs text-green-700 mb-1 font-medium">改判后理由（新）</p>
                    <p className="text-sm text-gray-900 font-medium">
                      {judgment.newRemark || '无'}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      状态：<StatusBadge status={judgment.newStatus} />
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
