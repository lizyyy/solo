import React from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Calendar, Target, ChevronRight, Eye, Download, RotateCcw, CheckCircle } from 'lucide-react';
import { TrainingRecord, WorkflowStatus } from '../../types';
import StatusBadge from '../common/StatusBadge';
import { formatDateTime, formatDistance, getDifficultyLabel, getDifficultyColor } from '../../utils/formatters';
import { getScenarioById } from '../../data/scenarios';

interface RecordCardProps {
  record: TrainingRecord;
  onExport?: (record: TrainingRecord) => void;
  onApprove?: (record: TrainingRecord) => void;
  onReturn?: (record: TrainingRecord) => void;
  isInstructor?: boolean;
}

export const RecordCard: React.FC<RecordCardProps> = ({
  record,
  onExport,
  onApprove,
  onReturn,
  isInstructor = false
}) => {
  const navigate = useNavigate();
  const scenario = getScenarioById(record.scenarioId);

  const handleView = () => {
    navigate(`/review/${record.id}`);
  };

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden hover:border-slate-600 transition-all group">
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="font-semibold text-white text-lg">
                {scenario?.name || '未知训练场景'}
              </h3>
              <StatusBadge status={record.workflow.status} />
              {scenario && (
                <span className={`text-xs font-semibold ${getDifficultyColor(scenario.difficulty)}`}>
                  {getDifficultyLabel(scenario.difficulty)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-slate-400">
              <span className="flex items-center gap-1">
                <User size={14} />
                {record.traineeName}
              </span>
              <span className="flex items-center gap-1">
                <Calendar size={14} />
                {formatDateTime(new Date(record.startTime))}
              </span>
            </div>
          </div>
          <button
            onClick={handleView}
            className="p-2 rounded-lg bg-slate-700/50 text-slate-400 hover:bg-slate-600 hover:text-white transition-all group-hover:translate-x-1"
            title="查看详情"
          >
            <Eye size={18} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="bg-slate-900/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold font-mono text-blue-400">
              {record.finalError !== undefined
                ? Math.round(record.finalError)
                : '-'}
            </div>
            <div className="text-xs text-slate-400">定位误差 (米)</div>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold font-mono text-purple-400">
              {record.operations.length}
            </div>
            <div className="text-xs text-slate-400">操作步骤</div>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold font-mono text-orange-400">
              {record.endTime
                ? Math.round((new Date(record.endTime).getTime() - new Date(record.startTime).getTime()) / 1000 / 60)
                : '-'}
            </div>
            <div className="text-xs text-slate-400">用时 (分钟)</div>
          </div>
        </div>

        {record.workflow.reviewComment && (
          <div className={`p-3 rounded-lg mb-4 ${
            record.workflow.status === WorkflowStatus.APPROVED
              ? 'bg-green-900/30 border border-green-700/50'
              : 'bg-red-900/30 border border-red-700/50'
          }`}>
            <div className="text-xs font-semibold mb-1 flex items-center gap-1">
              {record.workflow.status === WorkflowStatus.APPROVED ? (
                <><CheckCircle size={12} className="text-green-400" /> 复核意见</>
              ) : (
                <><RotateCcw size={12} className="text-red-400" /> 退回原因</>
              )}
            </div>
            <div className="text-sm text-slate-200">
              {record.workflow.reviewComment}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-slate-700">
          <div className="text-xs text-slate-500">
            记录编号：{record.id.slice(0, 12)}...
          </div>
          <div className="flex items-center gap-2">
            {isInstructor && record.workflow.status === WorkflowStatus.PENDING && (
              <>
                <button
                  onClick={() => onApprove?.(record)}
                  className="px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-500 transition-colors flex items-center gap-1"
                >
                  <CheckCircle size={12} />
                  通过
                </button>
                <button
                  onClick={() => onReturn?.(record)}
                  className="px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-500 transition-colors flex items-center gap-1"
                >
                  <RotateCcw size={12} />
                  退回
                </button>
              </>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onExport?.(record); }}
              className="px-3 py-1.5 bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg hover:bg-slate-600 hover:text-white transition-colors flex items-center gap-1"
            >
              <Download size={12} />
              导出
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecordCard;
