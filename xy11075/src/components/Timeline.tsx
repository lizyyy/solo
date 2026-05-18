import { STATUS_LABELS, DeductionAction, type StatusHistory } from '../../shared/types';
import { CheckCircle, ArrowRight, AlertCircle, Clock } from 'lucide-react';

interface TimelineProps {
  history: StatusHistory[];
}

const actionIcons: Record<string, React.ReactNode> = {
  SUBMIT: <ArrowRight className="w-4 h-4" />,
  APPROVE: <CheckCircle className="w-4 h-4" />,
  REJECT: <AlertCircle className="w-4 h-4" />,
  APPEAL: <AlertCircle className="w-4 h-4" />,
  APPEAL_APPROVE: <CheckCircle className="w-4 h-4" />,
  APPEAL_REJECT: <AlertCircle className="w-4 h-4" />,
  CLOSE: <CheckCircle className="w-4 h-4" />,
};

const Timeline: React.FC<TimelineProps> = ({ history }) => {
  return (
    <div className="space-y-4">
      {history.map((item, index) => (
        <div key={item.id} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              item.action === DeductionAction.REJECT || item.action === DeductionAction.APPEAL_REJECT
                ? 'bg-red-100 text-red-600'
                : item.action === DeductionAction.APPEAL
                ? 'bg-orange-100 text-orange-600'
                : 'bg-teal-100 text-teal-600'
            }`}>
              {actionIcons[item.action] || <Clock className="w-4 h-4" />}
            </div>
            {index < history.length - 1 && (
              <div className="w-px h-full bg-gray-200 mt-2" />
            )}
          </div>
          <div className="flex-1 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-gray-900">{item.operatorName}</span>
              <span className="text-sm text-gray-500">({item.operatorRole})</span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm text-gray-600">
                从 <span className="font-medium">{item.fromStatus ? STATUS_LABELS[item.fromStatus] : '新建'}</span>
              </span>
              <span className="text-gray-400">→</span>
              <span className="text-sm text-gray-600">
                到 <span className="font-medium text-teal-700">{STATUS_LABELS[item.toStatus]}</span>
              </span>
            </div>
            {item.remark && (
              <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded mb-2">{item.remark}</p>
            )}
            <div className="flex items-center gap-4 text-xs text-gray-400">
              <span>{new Date(item.createdAt).toLocaleString('zh-CN')}</span>
              {item.scoreSnapshot !== undefined && (
                <span>当前扣分: {item.scoreSnapshot} 分</span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default Timeline;
