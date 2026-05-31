import { useState } from 'react';
import { Send, MessageSquarePlus } from 'lucide-react';
import type { Correction, CreateCorrectionRequest } from '@shared/types';
import { useLabStore } from '@/store/useLabStore';

interface CorrectionFormProps {
  batchId: string;
  onSuccess?: () => void;
}

export function CorrectionForm({ batchId, onSuccess }: CorrectionFormProps) {
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<Correction['category']>('suggestion');
  const [points, setPoints] = useState('');
  const [author, setAuthor] = useState('李助教');
  const [submitting, setSubmitting] = useState(false);

  const addCorrection = useLabStore((state) => state.addCorrection);
  const error = useLabStore((state) => state.error);
  const clearError = useLabStore((state) => state.clearError);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !author.trim()) return;

    setSubmitting(true);
    try {
      const request: CreateCorrectionRequest = {
        content: content.trim(),
        author: author.trim(),
        category,
        points: category === 'deduction' && points ? parseFloat(points) : undefined,
      };
      await addCorrection(batchId, request);
      setContent('');
      setPoints('');
      clearError();
      onSuccess?.();
    } catch {
      // Error handled by store
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card p-4">
      <h4 className="section-title flex items-center gap-2">
        <MessageSquarePlus size={16} />
        添加批改意见
      </h4>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-ink-500 mb-1">类型</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Correction['category'])}
              className="select"
            >
              <option value="praise">表扬</option>
              <option value="suggestion">建议</option>
              <option value="error">错误</option>
              <option value="deduction">扣分</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-ink-500 mb-1">批改人</label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className="input"
              placeholder="输入批改人姓名"
            />
          </div>
        </div>

        {category === 'deduction' && (
          <div>
            <label className="block text-xs text-ink-500 mb-1">扣分数值</label>
            <input
              type="number"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              className="input"
              placeholder="输入扣分数值"
              min="0"
              step="0.5"
            />
          </div>
        )}

        <div>
          <label className="block text-xs text-ink-500 mb-1">意见内容</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="textarea"
            placeholder="请输入批改意见..."
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
            disabled={submitting || !content.trim() || !author.trim()}
            className="btn btn-primary flex items-center gap-2"
          >
            <Send size={14} />
            {submitting ? '提交中...' : '提交意见'}
          </button>
        </div>
      </form>
    </div>
  );
}
