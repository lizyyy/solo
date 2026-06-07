import { Filter } from 'lucide-react';
import { useRecordStore } from '../store/useRecordStore';
import { RecordCard } from './RecordCard';
import { RecordStatus, STATUS_CONFIG } from '../types';

export function RecordList() {
  const { records, selectedRecordId, filterStatus, setFilterStatus, selectRecord } = useRecordStore();
  
  const filteredRecords = filterStatus === 'all' 
    ? records 
    : records.filter(r => r.status === filterStatus);

  const filterOptions: Array<{ value: RecordStatus | 'all'; label: string }> = [
    { value: 'all', label: '全部' },
    { value: 'normal', label: STATUS_CONFIG.normal.label },
    { value: 'pending_review', label: STATUS_CONFIG.pending_review.label },
    { value: 'supplemented', label: STATUS_CONFIG.supplemented.label },
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-700">状态筛选</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setFilterStatus(option.value)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                filterStatus === option.value
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {option.label}
              <span className="ml-1 opacity-70">
                ({option.value === 'all' ? records.length : records.filter(r => r.status === option.value).length})
              </span>
            </button>
          ))}
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredRecords.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <p>暂无符合条件的记录</p>
          </div>
        ) : (
          filteredRecords.map((record) => (
            <RecordCard
              key={record.id}
              record={record}
              isSelected={selectedRecordId === record.id}
              onClick={() => selectRecord(record.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
