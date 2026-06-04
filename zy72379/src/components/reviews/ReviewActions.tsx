import React, { useState } from 'react';
import { Wrench, Check, X, Clock } from 'lucide-react';
import type { ThresholdAlert, ReviewStatus } from '@/types';
import { useCleaningStore } from '@/store/useCleaningStore';

interface ReviewActionsProps {
  alert: ThresholdAlert;
  onCancel?: () => void;
}

export const ReviewActions: React.FC<ReviewActionsProps> = ({ alert, onCancel }) => {
  const { reviewThresholdAlert } = useCleaningStore();
  const [reviewerName, setReviewerName] = useState('维修师傅');
  const [reviewComment, setReviewComment] = useState('');

  const handleReview = (status: ReviewStatus) => {
    reviewThresholdAlert(alert.id, status, reviewerName, reviewComment);
    if (onCancel) onCancel();
  };

  return (
    <div className="p-4 bg-primary-50 border border-primary-200 rounded-lg space-y-4">
      <div className="flex items-center gap-2">
        <Wrench className="w-4 h-4 text-primary-600" />
        <span className="font-medium text-primary-800">维修师傅复核操作</span>
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium text-neutral-700 mb-1">复核人</label>
        <input
          type="text"
          value={reviewerName}
          onChange={(e) => setReviewerName(e.target.value)}
          className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium text-neutral-700 mb-1">复核说明</label>
        <textarea
          value={reviewComment}
          onChange={(e) => setReviewComment(e.target.value)}
          className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="请输入复核说明..."
          rows={2}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => handleReview('confirmed')}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-success-500 text-white rounded-lg hover:bg-success-600 transition-colors"
        >
          <Check className="w-4 h-4" />
          确认正常
        </button>
        <button
          onClick={() => handleReview('needs_recalibration')}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-warning-500 text-white rounded-lg hover:bg-warning-600 transition-colors"
        >
          <Wrench className="w-4 h-4" />
          需要校准
        </button>
        <button
          onClick={() => handleReview('rejected')}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-danger-500 text-white rounded-lg hover:bg-danger-600 transition-colors"
        >
          <X className="w-4 h-4" />
          数据作废
        </button>
      </div>

      {onCancel && (
        <button
          onClick={onCancel}
          className="w-full py-2 text-sm text-neutral-600 hover:text-neutral-800 transition-colors"
        >
          取消
        </button>
      )}
    </div>
  );
};
