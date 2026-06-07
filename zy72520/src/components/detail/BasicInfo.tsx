import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ReviewRecord, RECORD_TYPE_LABELS, RECORD_STATUS_LABELS } from '../../types';

interface BasicInfoProps {
  record: ReviewRecord;
}

const BasicInfo = ({ record }: BasicInfoProps) => {
  const navigate = useNavigate();
  
  const statusColors = {
    pending: 'tag-warning',
    confirmed: 'tag-success',
    rejected: 'tag-danger',
  };
  
  const typeColors = {
    normal: 'tag-success',
    duplicate: 'tag-warning',
    supplement: 'tag-danger',
  };

  return (
    <div className="card-border mb-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-primary-700 mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            返回列表
          </button>
          
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-2xl font-serif font-bold text-primary-900">{record.id}</h2>
            <span className={statusColors[record.status]}>
              {RECORD_STATUS_LABELS[record.status]}
            </span>
            <span className={typeColors[record.type]}>
              {RECORD_TYPE_LABELS[record.type]}
            </span>
            {record.duplicateCount && record.duplicateCount > 1 && (
              <span className="tag bg-orange-100 text-orange-800">
                重复 {record.duplicateCount} 次
              </span>
            )}
          </div>
          
          <p className="text-gray-700 mb-4 leading-relaxed">{record.userFeedback}</p>
          
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-400 mb-1">用户ID</p>
              <p className="font-medium text-primary-800">{record.userId}</p>
            </div>
            <div>
              <p className="text-gray-400 mb-1">模型版本</p>
              <p className="font-medium text-primary-800">{record.modelVersion}</p>
            </div>
            <div>
              <p className="text-gray-400 mb-1">灰度批次</p>
              <p className="font-medium text-primary-800">{record.batchId}</p>
            </div>
            <div>
              <p className="text-gray-400 mb-1">更新时间</p>
              <p className="font-medium text-primary-800">{record.updatedAt}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BasicInfo;
