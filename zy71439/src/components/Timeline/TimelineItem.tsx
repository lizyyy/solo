import React from 'react';
import {
  Compass,
  Edit3,
  MapPin,
  Move,
  Route,
  Send,
  AlertTriangle,
  CheckCircle,
  RotateCcw,
  Circle
} from 'lucide-react';
import { OperationLog, OperationType } from '../../types';
import { formatTime, getOperationTypeLabel } from '../../utils/formatters';

interface TimelineItemProps {
  operation: OperationLog;
  isFirst?: boolean;
  isLast?: boolean;
  onClick?: () => void;
}

const iconMap: Record<OperationType, React.ReactNode> = {
  [OperationType.BEARING_INPUT]: <Compass size={14} />,
  [OperationType.BEARING_MODIFY]: <Edit3 size={14} />,
  [OperationType.POSITION_MARK]: <MapPin size={14} />,
  [OperationType.POSITION_ADJUST]: <Move size={14} />,
  [OperationType.ROUTE_SELECT]: <Route size={14} />,
  [OperationType.SUBMIT]: <Send size={14} />,
  [OperationType.UNIT_ERROR_DETECTED]: <AlertTriangle size={14} />,
  [OperationType.REVIEW_APPROVE]: <CheckCircle size={14} />,
  [OperationType.REVIEW_RETURN]: <RotateCcw size={14} />
};

const colorMap: Record<OperationType, string> = {
  [OperationType.BEARING_INPUT]: 'bg-blue-500',
  [OperationType.BEARING_MODIFY]: 'bg-purple-500',
  [OperationType.POSITION_MARK]: 'bg-red-500',
  [OperationType.POSITION_ADJUST]: 'bg-orange-500',
  [OperationType.ROUTE_SELECT]: 'bg-green-500',
  [OperationType.SUBMIT]: 'bg-indigo-500',
  [OperationType.UNIT_ERROR_DETECTED]: 'bg-red-600 animate-pulse',
  [OperationType.REVIEW_APPROVE]: 'bg-green-600',
  [OperationType.REVIEW_RETURN]: 'bg-yellow-600'
};

export const TimelineItem: React.FC<TimelineItemProps> = ({
  operation,
  isFirst = false,
  isLast = false,
  onClick
}) => {
  const Icon = iconMap[operation.actionType] || <Circle size={14} />;
  const colorClass = colorMap[operation.actionType] || 'bg-slate-500';

  return (
    <div
      className={`relative pl-8 pb-4 ${isLast ? 'pb-0' : ''} cursor-pointer group`}
      onClick={onClick}
    >
      {!isLast && (
        <div className="absolute left-3 top-6 bottom-0 w-0.5 bg-slate-700 group-hover:bg-slate-600 transition-colors" />
      )}

      <div
        className={`absolute left-0 top-0 w-6 h-6 rounded-full ${colorClass} flex items-center justify-center text-white shadow-lg transition-transform group-hover:scale-110`}
      >
        {Icon}
      </div>

      <div className="bg-slate-800/50 rounded-lg p-3 ml-2 border border-slate-700/50 group-hover:border-slate-600 transition-all group-hover:bg-slate-800">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-slate-300">
            {getOperationTypeLabel(operation.actionType)}
          </span>
          <span className="text-xs text-slate-500 font-mono">
            {formatTime(new Date(operation.timestamp))}
          </span>
        </div>

        <p className="text-sm text-slate-200">{operation.actionDetail}</p>

        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="text-slate-500">操作人：{operation.operator}</span>
          {operation.actionType === OperationType.UNIT_ERROR_DETECTED && (
            <span className="text-red-400 font-semibold">⚠️ 错误已记录</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default TimelineItem;
