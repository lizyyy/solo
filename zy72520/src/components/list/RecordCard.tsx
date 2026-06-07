import { Clock, User, CheckCircle, AlertTriangle, XCircle, ChevronRight, Copy, AlertOctagon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ReviewRecord, RECORD_TYPE_LABELS, RECORD_STATUS_LABELS } from '../../types';

interface RecordCardProps {
  record: ReviewRecord;
  index: number;
}

const RecordCard = ({ record, index }: RecordCardProps) => {
  const navigate = useNavigate();
  
  const typeConfig = {
    normal: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', icon: CheckCircle },
    duplicate: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: Copy },
    supplement: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', icon: AlertOctagon },
  };
  
  const statusConfig = {
    pending: { bg: 'bg-amber-100', text: 'text-amber-800', icon: AlertTriangle },
    confirmed: { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle },
    rejected: { bg: 'bg-red-100', text: 'text-red-800', icon: XCircle },
  };
  
  const TypeIcon = typeConfig[record.type].icon;
  const StatusIcon = statusConfig[record.status].icon;

  return (
    <div 
      onClick={() => navigate(`/review/${record.id}`)}
      className="card-border cursor-pointer group animate-slide-up"
      style={{ animationDelay: `${index * 0.1}s` }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${typeConfig[record.type].bg}`}>
            <TypeIcon className={`w-5 h-5 ${typeConfig[record.type].text}`} />
          </div>
          <div>
            <h3 className="font-semibold text-primary-800 font-serif">{record.id}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`tag ${typeConfig[record.type].bg} ${typeConfig[record.type].text}`}>
                {RECORD_TYPE_LABELS[record.type]}
              </span>
              <span className={`tag ${statusConfig[record.status].bg} ${statusConfig[record.status].text}`}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {RECORD_STATUS_LABELS[record.status]}
              </span>
              {record.duplicateCount && record.duplicateCount > 1 && (
                <span className="tag bg-orange-100 text-orange-800">
                  重复 {record.duplicateCount} 次
                </span>
              )}
            </div>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-primary-600 group-hover:translate-x-1 transition-all" />
      </div>
      
      <p className="text-gray-700 text-sm leading-relaxed mb-4 line-clamp-2">
        {record.userFeedback}
      </p>
      
      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <User className="w-3.5 h-3.5" />
            {record.userId}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {record.createdAt}
          </span>
        </div>
        <span className="text-xs text-gray-400">{record.modelVersion}</span>
      </div>
    </div>
  );
};

export default RecordCard;
