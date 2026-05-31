import { useState } from 'react';
import { CheckCircle2, UserCheck } from 'lucide-react';
import type { CreateConfirmationRequest, TimelineEvent } from '@shared/types';
import { useLabStore } from '@/store/useLabStore';

interface ConfirmationFormProps {
  batchId: string;
  relatedEvent?: TimelineEvent | null;
  onSuccess?: () => void;
}

export function ConfirmationForm({ batchId, relatedEvent, onSuccess }: ConfirmationFormProps) {
  const [content, setContent] = useState('');
  const [confirmer, setConfirmer] = useState('王老师');
  const [submitting, setSubmitting] = useState(false);

  const addConfirmation = useLabStore((state) => state.addConfirmation);
  const error = useLabStore((state) => state.error);
  const clearError = useLabStore((state) => state.clearError);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !confirmer.trim()) return;

    setSubmitting(true);
    try {
      const request: CreateConfirmationRequest = {
        content: content.trim(),
        confirmer: confirmer.trim(),
        relatedItemId: relatedEvent?.id,
        relatedItemType: relatedEvent?.type === 'viscosity_estimate' ? 'viscosity_estimate' :
          relatedEvent?.type === 'correction' ? 'correction' :
          relatedEvent?.type === 'sensor_log' ? 'sensor_log' : undefined,
      };
      await addConfirmation(batchId, request);
      setContent('');
      clearError();
      onSuccess?.();
    } catch {
      // Error handled by store
    } finally {
      setSubmitting(false);
    }
  };

  const relatedTypeLabel = relatedEvent?.type === 'viscosity_estimate' ? '黏度估计' :
    relatedEvent?.type === 'correction' ? '批改意见' :
    relatedEvent?.type === 'sensor_log' ? '传感器日志' :
    relatedEvent?.type === 'experiment_record' ? '实验记录' : '';

  return (
    <div className="card p-4">
      <h4 className="section-title flex items-center gap-2">
        <UserCheck size={16} />
        人工确认
      </h4>

      {relatedEvent && (
        <div className="mb-3 p-2 bg-ink-50 border border-ink-200 text-xs text-ink-600">
          <span className="font-medium">关联对象：</span>
          {relatedTypeLabel}
          {relatedEvent.id && <span className="font-mono ml-2 text-ink-400">#{relatedEvent.id.slice(0, 8)}</span>}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs text-ink-500 mb-1">确认人</label>
          <input
            type="text"
            value={confirmer}
            onChange={(e) => setConfirmer(e.target.value)}
            className="input"
            placeholder="输入确认人姓名"
          />
        </div>

        <div>
          <label className="block text-xs text-ink-500 mb-1">确认意见</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="textarea"
            placeholder="请输入人工确认意见..."
            rows={3}
          />
        </div>

        {error && (
          <div className="p-2 bg-brick-50 border border-brick-200 text-brick-700 text-xs">
            {error}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting || !content.trim() || !confirmer.trim()}
            className="btn btn-success flex items-center gap-2"
          >
            <CheckCircle2 size={14} />
            {submitting ? '确认中...' : '提交确认'}
          </button>
        </div>
      </form>
    </div>
  );
}
