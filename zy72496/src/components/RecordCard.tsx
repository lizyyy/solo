import { CanopyRecord } from '@/types';
import { StatusBadge } from './StatusBadge';
import { MapPin, AlertTriangle, FileText, Clock } from 'lucide-react';
import { useRecordsStore } from '@/store/useRecordsStore';

interface RecordCardProps {
  record: CanopyRecord;
}

export function RecordCard({ record }: RecordCardProps) {
  const { selectedRecordId, selectRecord } = useRecordsStore();
  const isSelected = selectedRecordId === record.id;

  return (
    <div
      onClick={() => selectRecord(record.id)}
      className={`p-4 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
        isSelected
          ? 'border-blue-500 bg-blue-50 shadow-md ring-2 ring-blue-200'
          : record.isSuspectedDuplicateName
          ? 'border-amber-300 bg-amber-50/50 hover:bg-amber-50'
          : 'border-slate-200 bg-white hover:bg-slate-50'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-slate-900 truncate">{record.communityName}</h3>
            {record.isSuspectedDuplicateName && (
              <span className="flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                <AlertTriangle className="w-3 h-3" />
                疑似同名
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-sm text-slate-500 mb-2">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{record.stationName}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <FileText className="w-3 h-3" />
              原始行号: {record.originalRowNumber}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(record.updatedAt).toLocaleDateString('zh-CN')}
            </span>
          </div>
        </div>
        <StatusBadge status={record.status} size="sm" />
      </div>
      {record.photoDescription && (
        <p className="mt-2 text-sm text-slate-600 line-clamp-2">{record.photoDescription}</p>
      )}
    </div>
  );
}
