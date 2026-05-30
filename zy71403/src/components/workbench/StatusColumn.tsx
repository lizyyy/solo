import type { RecordStatus, ValuationRecord } from '../../types';
import { RecordCard } from './RecordCard';
import { getStatusLabel, getStatusColors } from '../../utils/statusFlow';
import { FileX } from 'lucide-react';

interface StatusColumnProps {
  status: RecordStatus;
  records: ValuationRecord[];
}

export function StatusColumn({ status, records }: StatusColumnProps) {
  const colors = getStatusColors(status);
  const label = getStatusLabel(status);
  
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className={`flex items-center justify-between px-4 py-3 ${colors.bg} border-b-2 ${colors.border} rounded-t-xl`}>
        <div className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${colors.dot} ${status === 'pending' ? 'animate-pulse-soft' : ''}`} />
          <h3 className={`font-semibold ${colors.text}`}>{label}</h3>
        </div>
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text} border ${colors.border}`}>
          {records.length} 条
        </span>
      </div>
      
      <div className="flex-1 overflow-y-auto p-3 bg-slate-50/50 rounded-b-xl">
        {records.length > 0 ? (
          <div className="space-y-3">
            {records.map((record, index) => (
              <RecordCard key={record.valuationId} record={record} index={index} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 mb-3 rounded-full bg-white flex items-center justify-center border border-slate-200">
              <FileX className="w-6 h-6 text-slate-300" />
            </div>
            <p className="text-sm text-slate-500">暂无{label}记录</p>
          </div>
        )}
      </div>
    </div>
  );
}
