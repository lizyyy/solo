import { User, Paperclip, History } from 'lucide-react';
import type { DataRecord } from '../types';
import { SOURCE_LABELS, TYPE_LABELS } from '../types';
import { StatusBadge } from './StatusBadge';
import { TypeIcon, SourceIcon, AnomalyIcon } from './TypeIcon';
import { formatTimestamp, formatValue, truncateText } from '../utils/format';
import { buildEvidenceChain } from '../logic/evidenceChain';

interface RecordCardProps {
  record: DataRecord;
  isSelected: boolean;
  onClick: () => void;
}

export const RecordCard = ({ record, isSelected, onClick }: RecordCardProps) => {
  const evidenceChain = buildEvidenceChain(record);
  const hasLateAttachment = record.attachments.some(a => a.arrivedLate);
  const hasAnomaly = record.status === 'pending' && record.anomalyReason;

  const leftBorderColor: Record<string, string> = {
    normal: 'border-l-status-normal',
    pending: 'border-l-status-pending',
    corrected: 'border-l-status-corrected',
    duplicate: 'border-l-status-duplicate',
  };

  return (
    <div
      onClick={onClick}
      className={`relative pl-8 pb-6 cursor-pointer group ${
        isSelected ? '' : ''
      }`}
    >
      <div
        className={`absolute left-4 w-3 h-3 rounded-full -translate-x-1/2 border-2 border-slate-900 transition-all duration-200 timeline-dot timeline-dot-${record.status} ${
          isSelected ? 'scale-125 ring-4 ring-slate-700' : ''
        }`}
      />

      <div
        className={`bg-slate-800/80 rounded-lg border ${
          isSelected
            ? 'border-industrial-500 shadow-lg shadow-industrial-900/30'
            : 'border-slate-700 hover:border-slate-600'
        } transition-all duration-200 card-hover overflow-hidden`}
      >
        <div
          className={`absolute left-0 top-0 bottom-0 w-1 ${leftBorderColor[record.status]} rounded-l-lg`}
        />

        <div className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded flex items-center justify-center ${
                  record.source === 'teammate'
                    ? 'bg-blue-900/50 text-blue-400'
                    : record.source === 'model'
                    ? 'bg-purple-900/50 text-purple-400'
                    : 'bg-green-900/50 text-green-400'
                }`}
              >
                <SourceIcon source={record.source} className="w-4 h-4" />
              </div>
              <span className="text-xs text-slate-500">
                {SOURCE_LABELS[record.source]}
              </span>
              <span className="text-slate-600">·</span>
              <div className="flex items-center gap-1 text-slate-500">
                <TypeIcon type={record.type} className="w-3.5 h-3.5" />
                <span className="text-xs">{TYPE_LABELS[record.type]}</span>
              </div>
            </div>
            <StatusBadge status={record.status} size="sm" />
          </div>

          <h3 className="text-sm font-medium text-slate-200 mb-2 text-balance">
            {record.title}
          </h3>

          {record.data.value !== undefined && (
            <div className="mb-2 font-mono text-lg text-slate-100">
              {formatValue(record.data.value, record.data.unit)}
            </div>
          )}

          {record.data.description && (
            <p className="text-xs text-slate-400 mb-2 line-clamp-2">
              {truncateText(record.data.description, 60)}
            </p>
          )}

          {hasAnomaly && record.anomalyReason && (
            <div className="mb-3 p-2 bg-orange-900/30 border border-orange-800/50 rounded">
              <div className="flex items-center gap-1.5 text-orange-400 text-xs mb-1">
                <AnomalyIcon type={record.anomalyReason.type} className="w-3.5 h-3.5" />
                <span className="font-medium">
                  {record.anomalyReason.type === 'drift' && '结果漂移'}
                  {record.anomalyReason.type === 'unit_mismatch' && '单位混用'}
                  {record.anomalyReason.type === 'constraint_override' && '约束覆盖'}
                  {record.anomalyReason.type === 'late_attachment' && '晚到附件'}
                  {record.anomalyReason.type === 'duplicate' && '重复记录'}
                </span>
              </div>
              <p className="text-[11px] text-orange-300/80">
                {truncateText(record.anomalyReason.description, 50)}
              </p>
            </div>
          )}

          {evidenceChain.length > 0 && (
            <div className="mb-2">
              <div className="flex items-center gap-1 text-[11px] text-slate-500 mb-1">
                <History className="w-3 h-3" />
                <span>证据链 ({evidenceChain.length})</span>
              </div>
              <div className="space-y-1">
                {evidenceChain.slice(0, 2).map((ev) => (
                  <div
                    key={ev.id}
                    className="flex items-start gap-2 text-[11px] text-slate-400 evidence-connector"
                  >
                    <span className="text-slate-500 font-mono mt-0.5">
                      {formatTimestamp(ev.timestamp)}
                    </span>
                    <span className="text-slate-300">
                      {truncateText(ev.content, 40)}
                    </span>
                  </div>
                ))}
                {evidenceChain.length > 2 && (
                  <div className="text-[11px] text-slate-500 ml-2">
                    还有 {evidenceChain.length - 2} 条记录...
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-slate-700/50 mt-2">
            <div className="flex items-center gap-1 text-[11px] text-slate-500">
              <User className="w-3 h-3" />
              <span>{record.author}</span>
            </div>
            <div className="flex items-center gap-3">
              {record.attachments.length > 0 && (
                <div className="flex items-center gap-1 text-[11px] text-slate-500">
                  <Paperclip
                    className={`w-3 h-3 ${hasLateAttachment ? 'text-orange-400' : ''}`}
                  />
                  <span className={hasLateAttachment ? 'text-orange-400' : ''}>
                    {record.attachments.length}
                  </span>
                </div>
              )}
              <span className="text-[11px] text-slate-500 font-mono">
                {formatTimestamp(record.timestamp)}
              </span>
            </div>
          </div>

          {isSelected && (
            <div className="mt-2 pt-2 border-t border-slate-700/50">
              <div className="text-[11px] text-industrial-400 text-center">
                点击查看完整详情 →
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
