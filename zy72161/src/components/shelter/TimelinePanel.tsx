import React from 'react';
import { X, Clock, User, MessageSquare } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useShelter } from '@/hooks/useShelter';
import { StatusBadge } from '@/components/common/StatusBadge';
import { cn } from '@/lib/utils';

export const TimelinePanel: React.FC = () => {
  const { showTimeline, toggleTimeline, openDetailPanel } = useUIStore();
  const { getShelterRecords, shelters, setSelectedShelter } = useShelter();

  const allRecords = shelters
    .flatMap(shelter => getShelterRecords(shelter.id).map(record => ({ ...record, shelter })))
    .sort((a, b) => new Date(b.operateTime).getTime() - new Date(a.operateTime).getTime())
    .slice(0, 15);

  const handleRecordClick = (shelterId: string) => {
    const shelter = shelters.find(s => s.id === shelterId);
    if (shelter) {
      setSelectedShelter(shelter.id);
      openDetailPanel(shelterId);
    }
  };

  if (!showTimeline) {
    return (
      <button
        onClick={toggleTimeline}
        className="absolute right-4 top-4 z-20 flex items-center gap-2 rounded-xl border border-gray-700/50 bg-gray-800/80 px-4 py-3 text-sm text-gray-300 backdrop-blur-md transition-all hover:bg-gray-700/80"
      >
        <Clock className="h-4 w-4" />
        展开时间线
      </button>
    );
  }

  return (
    <div className="absolute right-4 top-4 z-20 flex h-[calc(100vh-8rem)] w-80 flex-col rounded-xl border border-gray-700/50 bg-gray-800/90 backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-gray-700/50 p-4">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-blue-400" />
          <h3 className="text-sm font-medium text-gray-200">处理记录时间线</h3>
        </div>
        <button
          onClick={toggleTimeline}
          className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-700 hover:text-gray-200"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {allRecords.map((record, idx) => (
            <div key={record.id} className="relative">
              {idx < allRecords.length - 1 && (
                <div className="absolute left-3 top-8 h-full w-px bg-gray-700" />
              )}

              <div className="relative flex gap-3">
                <div className={cn(
                  'relative z-10 mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-gray-800',
                  record.action === '初次审核' ? 'bg-green-500' :
                  record.action === '冲突处理' ? 'bg-purple-500' :
                  record.action === '补充材料' ? 'bg-yellow-500' :
                  'bg-blue-500'
                )}>
                  {record.action === '初次审核' ? '✓' :
                   record.action === '冲突处理' ? '!' :
                   record.action === '补充材料' ? '+' : '→'}
                </div>

                <div
                  onClick={() => handleRecordClick(record.shelterId)}
                  className="flex-1 cursor-pointer rounded-lg border border-gray-700/50 bg-gray-700/30 p-3 transition-all hover:border-blue-500/50 hover:bg-gray-700/50"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <p className="text-xs font-medium text-gray-200">{record.shelter.standardName}</p>
                    <StatusBadge status={record.newStatus} size="sm" />
                  </div>
                  <p className="text-xs text-gray-400">{record.remark}</p>
                  <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {record.operator}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      {record.action}
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] text-gray-600">{record.operateTime}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
