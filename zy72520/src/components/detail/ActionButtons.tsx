import { useState } from 'react';
import { Check, X, MessageSquare } from 'lucide-react';
import { RecordStatus } from '../../types';
import { useReviewStore } from '../../store/useReviewStore';

interface ActionButtonsProps {
  recordId: string;
  currentStatus: RecordStatus;
}

const ActionButtons = ({ recordId, currentStatus }: ActionButtonsProps) => {
  const updateRecordStatus = useReviewStore(state => state.updateRecordStatus);
  const [comment, setComment] = useState('');
  const [showComment, setShowComment] = useState(false);
  const [actionType, setActionType] = useState<'confirm' | 'reject' | null>(null);

  const handleAction = (status: RecordStatus) => {
    if (!showComment) {
      setActionType(status === 'confirmed' ? 'confirm' : 'reject');
      setShowComment(true);
      return;
    }
    
    updateRecordStatus(recordId, status, '周姐', comment || undefined);
    setShowComment(false);
    setComment('');
    setActionType(null);
  };

  const handleCancel = () => {
    setShowComment(false);
    setComment('');
    setActionType(null);
  };

  if (currentStatus !== 'pending') {
    return (
      <div className="card-border bg-gray-50">
        <div className="flex items-center justify-center py-4">
          <span className={`tag ${currentStatus === 'confirmed' ? 'tag-success' : 'tag-danger'}`}>
            {currentStatus === 'confirmed' ? '✓ 已确认' : '✗ 已驳回'}
          </span>
          <span className="text-sm text-gray-500 ml-3">该记录已处理完成</span>
        </div>
      </div>
    );
  }

  return (
    <div className="card-border border-amber-200 bg-amber-50/50">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="w-5 h-5 text-amber-600" />
        <h3 className="text-lg font-serif font-semibold text-amber-800">标注负责人复核</h3>
      </div>
      
      <p className="text-sm text-amber-700 mb-4">
        请周姐作为标注负责人，在审阅完整证据链后做出最终复核决定。同一用户反馈被重复计入的情况，请勿急于归为正常，请仔细复核。
      </p>
      
      {showComment && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            复核意见（可选）
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="请输入复核意见..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-400 focus:border-transparent text-sm resize-none"
            rows={3}
          />
        </div>
      )}
      
      <div className="flex items-center gap-3">
        {!showComment && (
          <>
            <button
              onClick={() => handleAction('confirmed')}
              className="btn-success flex-1"
            >
              <Check className="w-4 h-4 mr-2 inline" />
              确认通过
            </button>
            <button
              onClick={() => handleAction('rejected')}
              className="btn-danger flex-1"
            >
              <X className="w-4 h-4 mr-2 inline" />
              驳回处理
            </button>
          </>
        )}
        
        {showComment && (
          <>
            <button
              onClick={() => handleAction(actionType === 'confirm' ? 'confirmed' : 'rejected')}
              className={actionType === 'confirm' ? 'btn-success flex-1' : 'btn-danger flex-1'}
            >
              <Check className="w-4 h-4 mr-2 inline" />
              确认提交
            </button>
            <button
              onClick={handleCancel}
              className="btn-outline flex-1"
            >
              <X className="w-4 h-4 mr-2 inline" />
              取消
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default ActionButtons;
