import { ChevronLeft, Clock, AlertCircle, CheckCircle2, ThumbsUp } from 'lucide-react';
import { useAppStore, useRecordsByStatus } from '../../store/useAppStore';
import { StatusBadge } from '../common/StatusBadge';
import { SourceIcon } from '../common/SourceIcon';
import { RiskIndicator } from '../common/RiskIndicator';
import { CRACK_TYPE_LABELS, LOCATION_LABELS } from '../../types';
import type { CrackRecord } from '../../types';

interface RecordCardProps {
  record: CrackRecord;
  isSelected: boolean;
  onClick: () => void;
}

const RecordCard = ({ record, isSelected, onClick }: RecordCardProps) => {
  return (
    <div
      onClick={onClick}
      className={`p-3 rounded-lg cursor-pointer transition-all border ${
        isSelected
          ? 'bg-primary-600/30 border-primary-500 shadow-lg shadow-primary-500/20'
          : 'bg-dark-800/50 border-transparent hover:bg-dark-700/50 hover:border-dark-600'
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono font-medium text-white">{record.code}</span>
          {record.isOldCaliber && (
            <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded border border-amber-500/30">
              旧口径
            </span>
          )}
        </div>
        <StatusBadge status={record.status} />
      </div>

      <div className="flex items-center gap-3 mb-2">
        <SourceIcon source={record.source} showLabel />
        <RiskIndicator level={record.riskLevel} showLabel />
      </div>

      <p className="text-sm text-gray-300 mb-2 line-clamp-2">
        {record.description}
      </p>

      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <span className="px-1.5 py-0.5 bg-dark-700 rounded text-gray-400">
            {LOCATION_LABELS[record.location]}
          </span>
          <span className="px-1.5 py-0.5 bg-dark-700 rounded text-gray-400">
            {CRACK_TYPE_LABELS[record.crackType]}
          </span>
        </div>
        <span>{record.updatedAt.slice(5, 16)}</span>
      </div>
    </div>
  );
};

interface SectionHeaderProps {
  icon: typeof Clock;
  title: string;
  count: number;
  color: string;
}

const SectionHeader = ({ icon: Icon, title, count, color }: SectionHeaderProps) => (
  <div className="flex items-center gap-2 px-3 py-2 bg-dark-800/50 rounded-lg mb-2">
    <Icon className={`w-4 h-4 ${color}`} />
    <span className="text-sm font-medium text-gray-200">{title}</span>
    <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-medium ${color} bg-dark-700`}>
      {count}
    </span>
  </div>
);

export const LeftPanel = () => {
  const { selectedRecordId, setSelectedRecord, leftPanelCollapsed, toggleLeftPanel } = useAppStore();
  const { pending, processing, completed, confirmed } = useRecordsByStatus();

  if (leftPanelCollapsed) {
    return (
      <div className="w-12 glass border-r border-white/10 flex flex-col items-center py-4 gap-4">
        <button
          onClick={toggleLeftPanel}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors text-gray-300 hover:text-white"
        >
          <ChevronLeft className="w-5 h-5 rotate-180" />
        </button>
        <div className="flex flex-col gap-2">
          <div className="w-8 h-8 rounded-full bg-warning-500/20 flex items-center justify-center">
            <AlertCircle className="w-4 h-4 text-warning-400" />
          </div>
          <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center">
            <Clock className="w-4 h-4 text-primary-400" />
          </div>
          <div className="w-8 h-8 rounded-full bg-success-500/20 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4 text-success-400" />
          </div>
          <div className="w-8 h-8 rounded-full bg-dark-500/20 flex items-center justify-center">
            <ThumbsUp className="w-4 h-4 text-dark-400" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 glass border-r border-white/10 flex flex-col h-full">
      <div className="p-3 border-b border-white/10 flex items-center justify-between">
        <h2 className="text-base font-semibold text-white">异常记录列表</h2>
        <button
          onClick={toggleLeftPanel}
          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {pending.length > 0 && (
          <div>
            <SectionHeader
              icon={AlertCircle}
              title="待处理"
              count={pending.length}
              color="text-warning-400"
            />
            <div className="space-y-2">
              {pending.map(record => (
                <RecordCard
                  key={record.id}
                  record={record}
                  isSelected={selectedRecordId === record.id}
                  onClick={() => setSelectedRecord(record.id)}
                />
              ))}
            </div>
          </div>
        )}

        {processing.length > 0 && (
          <div>
            <SectionHeader
              icon={Clock}
              title="处理中"
              count={processing.length}
              color="text-primary-400"
            />
            <div className="space-y-2">
              {processing.map(record => (
                <RecordCard
                  key={record.id}
                  record={record}
                  isSelected={selectedRecordId === record.id}
                  onClick={() => setSelectedRecord(record.id)}
                />
              ))}
            </div>
          </div>
        )}

        {completed.length > 0 && (
          <div>
            <SectionHeader
              icon={CheckCircle2}
              title="已处理"
              count={completed.length}
              color="text-success-400"
            />
            <div className="space-y-2">
              {completed.map(record => (
                <RecordCard
                  key={record.id}
                  record={record}
                  isSelected={selectedRecordId === record.id}
                  onClick={() => setSelectedRecord(record.id)}
                />
              ))}
            </div>
          </div>
        )}

        {confirmed.length > 0 && (
          <div>
            <SectionHeader
              icon={ThumbsUp}
              title="已确认"
              count={confirmed.length}
              color="text-dark-400"
            />
            <div className="space-y-2">
              {confirmed.map(record => (
                <RecordCard
                  key={record.id}
                  record={record}
                  isSelected={selectedRecordId === record.id}
                  onClick={() => setSelectedRecord(record.id)}
                />
              ))}
            </div>
          </div>
        )}

        {pending.length === 0 && processing.length === 0 && completed.length === 0 && confirmed.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="w-12 h-12 text-gray-600 mb-3" />
            <p className="text-gray-400 text-sm">暂无异常记录</p>
            <p className="text-gray-500 text-xs mt-1">点击"导入数据"添加记录</p>
          </div>
        )}
      </div>
    </div>
  );
};
