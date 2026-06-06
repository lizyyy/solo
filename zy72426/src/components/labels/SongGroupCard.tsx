import { useState } from 'react';
import type { SongGroup, SongRecord } from '@/types';
import { RecordRow } from './RecordRow';
import { ReviewStatusBadge } from '@/components/common/StatusBadge';
import { ChevronDown, ChevronUp, Users, Check, X, Edit3 } from 'lucide-react';
import { useEmotionLabelStore } from '@/store/useEmotionLabelStore';
import { cn } from '@/lib/utils';

interface SongGroupCardProps {
  group: SongGroup;
  records: SongRecord[];
}

export const SongGroupCard = ({ group, records }: SongGroupCardProps) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditingName, setIsEditingName] = useState(false);
  const [canonicalName, setCanonicalName] = useState(group.canonicalName);
  const { confirmGroup, rejectGroup, updateRecord } = useEmotionLabelStore();

  const handleSaveName = () => {
    records.forEach((r) => {
      updateRecord(r.id, {}, '许老师', '修改分组名称');
    });
    setIsEditingName(false);
  };

  const pendingCount = records.filter((r) => r.status === 'reviewing').length;

  return (
    <div className="border border-amber-200 rounded-sm overflow-hidden mb-4">
      <div
        className={cn(
          'flex items-center justify-between px-5 py-3 cursor-pointer transition-colors',
          group.reviewStatus === 'pending' ? 'bg-amber-50' : 'bg-green-50',
          group.reviewStatus === 'rejected' && 'bg-gray-50'
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <button className="text-gray-500 hover:text-gray-700">
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
          <Users className="w-5 h-5 text-amber-600" />
          {isEditingName ? (
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <input
                type="text"
                value={canonicalName}
                onChange={(e) => setCanonicalName(e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                autoFocus
              />
              <button onClick={handleSaveName} className="text-green-600 hover:text-green-700">
                <Check className="w-4 h-4" />
              </button>
              <button onClick={() => setIsEditingName(false)} className="text-red-600 hover:text-red-700">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-gray-800">{group.canonicalName}</h4>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditingName(true);
                }}
                className="opacity-0 hover:opacity-100 text-gray-400 hover:text-gray-600"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </div>
          )}
          <span className="text-sm text-gray-500">{records.length} 条记录</span>
          {pendingCount > 0 && (
            <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
              {pendingCount} 条待复核
            </span>
          )}
        </div>

        <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
          <ReviewStatusBadge status={group.reviewStatus} />
          {group.reviewStatus === 'pending' && (
            <>
              <button
                onClick={() => confirmGroup(group.id, '许老师')}
                className="px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors flex items-center gap-1"
              >
                <Check className="w-3 h-3" />
                确认关联
              </button>
              <button
                onClick={() => rejectGroup(group.id)}
                className="px-3 py-1.5 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                标记独立
              </button>
            </>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs">
                <th className="px-4 py-2 text-left font-medium text-gray-500 w-24">原始行号</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">现场名</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">版权名</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500 w-40">情绪标签</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500 w-24">状态</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">音频备注</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500 w-28">导入版本</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500 w-20">改动</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <RecordRow key={record.id} record={record} isGrouped />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
