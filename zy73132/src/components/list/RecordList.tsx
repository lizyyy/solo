import React from 'react';
import { Database, AlertOctagon, Hash, MessageSquare, ArrowRight } from 'lucide-react';
import useAppStore from '../../store/useAppStore';
import { formatDateTime, getStatusLabel, getAnomalyTypeLabel } from '../../utils/helpers';
import type { TidalRecord } from '../../types';

const getStatusBgClass = (status: string) => {
  switch (status) {
    case 'confirmed': return 'status-confirmed';
    case 'pending': return 'status-pending';
    case 'returned': return 'status-returned';
    default: return 'bg-slate-500';
  }
};

const getAnomalyBadgeStyle = (type: string) => {
  switch (type) {
    case 'outlier': return 'bg-anomaly-500/20 text-anomaly-400 border-anomaly-500/40';
    case 'unit_mismatch': return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
    case 'bottle_mismatch': return 'bg-purple-500/20 text-purple-400 border-purple-500/40';
    case 'manual_change': return 'bg-pink-500/20 text-pink-400 border-pink-500/40';
    default: return 'bg-slate-500/20 text-slate-400 border-slate-500/40';
  }
};

const RecordList: React.FC = () => {
  const { getFilteredRecords, selectedRecordId, setSelectedRecord } = useAppStore();
  const records = getFilteredRecords();

  return (
    <div className="h-full glass-panel rounded-xl overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-ocean-400/15 flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold text-ocean-300 flex items-center gap-2">
          <Database className="w-4 h-4" />
          采样记录
        </h3>
        <span className="text-xs text-slate-400">{records.length} 条</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {records.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-500 text-sm">
            <div className="text-center">
              <Database className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>暂无符合条件的记录</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-ocean-400/10">
            {records.map(record => (
              <RecordItem
                key={record.id}
                record={record}
                isSelected={record.id === selectedRecordId}
                onClick={() => setSelectedRecord(record.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface RecordItemProps {
  record: TidalRecord;
  isSelected: boolean;
  onClick: () => void;
}

const RecordItem: React.FC<RecordItemProps> = ({ record, isSelected, onClick }) => {
  return (
    <div
      onClick={onClick}
      className={`relative px-4 py-3 cursor-pointer transition-all duration-200 group ${
        isSelected
          ? 'bg-ocean-400/10 border-l-2 border-ocean-400'
          : 'hover:bg-deep-sea-700/50 border-l-2 border-transparent'
      }`}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${getStatusBgClass(record.status)}`} />

      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-mono text-slate-300">{formatDateTime(record.timestamp)}</span>
            {record.isAnomaly && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded border flex items-center gap-1 ${getAnomalyBadgeStyle(record.anomalyType)}`}>
                <AlertOctagon className="w-2.5 h-2.5" />
                {getAnomalyTypeLabel(record.anomalyType)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-slate-400">
              <Hash className="w-3 h-3" />
              <span className={`font-mono ${record.bottleVersion === 'old' ? 'text-amber-400' : 'text-slate-300'}`}>
                {record.bottleId}
                {record.bottleVersion === 'old' && ' ⚠'}
              </span>
            </span>
            <span className={`font-mono font-medium ${record.originalUnit !== record.unit ? 'text-amber-400' : 'text-ocean-300'}`}>
              {record.waterLevel} {record.unit}
              {record.originalUnit !== record.unit && <span className="ml-1 text-[10px]">(原{record.originalUnit})</span>}
            </span>
          </div>

          {record.anomalyReason && (
            <p className="text-xs text-slate-500 mt-1.5 line-clamp-1 truncate">
              {record.anomalyReason}
            </p>
          )}
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
            record.status === 'confirmed' ? 'bg-[#2D6A4F]/30 text-[#52b788]' :
            record.status === 'pending' ? 'bg-[#FFB627]/20 text-[#FFB627]' :
            'bg-[#C92A2A]/30 text-[#fa5252]'
          }`}>
            {getStatusLabel(record.status)}
          </span>
          <ArrowRight className={`w-3.5 h-3.5 transition-transform ${
            isSelected ? 'text-ocean-400 translate-x-0' : 'text-slate-600 -translate-x-1 opacity-0 group-hover:opacity-100 group-hover:translate-x-0'
          }`} />
        </div>
      </div>
    </div>
  );
};

export default RecordList;
