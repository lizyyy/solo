import { useState } from 'react';
import type { ReviewDecision } from '../types';

interface ReviewFormProps {
  onSubmit: (data: {
    decision: ReviewDecision;
    evidence: string;
    comments?: string;
    reviewer: string;
  }) => void;
  onCancel?: () => void;
  isSubmitting?: boolean;
  defaultReviewer?: string;
}

export default function ReviewForm({ onSubmit, onCancel, isSubmitting, defaultReviewer = '周姐' }: ReviewFormProps) {
  const [decision, setDecision] = useState<ReviewDecision>('approve');
  const [evidence, setEvidence] = useState('');
  const [comments, setComments] = useState('');
  const [reviewer, setReviewer] = useState(defaultReviewer);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!evidence.trim()) return;
    
    onSubmit({
      decision,
      evidence: evidence.trim(),
      comments: comments.trim() || undefined,
      reviewer: reviewer.trim(),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          复核人 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={reviewer}
          onChange={e => setReviewer(e.target.value)}
          className="input"
          placeholder="请输入复核人姓名"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          复核结论 <span className="text-red-500">*</span>
        </label>
        <div className="flex space-x-4">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="radio"
              name="decision"
              value="approve"
              checked={decision === 'approve'}
              onChange={() => setDecision('approve')}
              className="w-4 h-4 text-green-600 focus:ring-green-500"
            />
            <span className="text-green-700 font-medium">通过</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="radio"
              name="decision"
              value="reject"
              checked={decision === 'reject'}
              onChange={() => setDecision('reject')}
              className="w-4 h-4 text-red-600 focus:ring-red-500"
            />
            <span className="text-red-700 font-medium">驳回</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="radio"
              name="decision"
              value="escalate"
              checked={decision === 'escalate'}
              onChange={() => setDecision('escalate')}
              className="w-4 h-4 text-yellow-600 focus:ring-yellow-500"
            />
            <span className="text-yellow-700 font-medium">升级复核</span>
          </label>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          复核证据 <span className="text-red-500">*</span>
        </label>
        <textarea
          value={evidence}
          onChange={e => setEvidence(e.target.value)}
          className="textarea min-h-[100px]"
          placeholder="请说明复核依据，如：与合同原文一致 / 模型抽取错误，正确值应为xxx / 需进一步确认..."
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          备注（可选）
        </label>
        <textarea
          value={comments}
          onChange={e => setComments(e.target.value)}
          className="textarea min-h-[60px]"
          placeholder="其他需要说明的信息..."
        />
      </div>

      <div className="flex justify-end space-x-3 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="btn-secondary"
            disabled={isSubmitting}
          >
            取消
          </button>
        )}
        <button
          type="submit"
          className="btn-primary"
          disabled={isSubmitting || !evidence.trim()}
        >
          {isSubmitting ? '提交中...' : '提交复核'}
        </button>
      </div>
    </form>
  );
}
