import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { useReviewForSample, useSampleById } from '@/hooks/useFilteredData';
import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle, Clock, Send } from 'lucide-react';
import type { ReviewAction } from '@/types';

const ACTION_CONFIG: Record<
  ReviewAction,
  { label: string; color: string; icon: React.ReactNode }
> = {
  approved: {
    label: '通过',
    color: 'bg-green-500 hover:bg-green-600 text-white',
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
  rejected: {
    label: '驳回',
    color: 'bg-red-500 hover:bg-red-600 text-white',
    icon: <XCircle className="h-4 w-4" />,
  },
  pending: {
    label: '待定',
    color: 'bg-yellow-500 hover:bg-yellow-600 text-white',
    icon: <Clock className="h-4 w-4" />,
  },
};

const BORDER_MAP: Record<ReviewAction | 'none', string> = {
  approved: 'border-2 border-green-500',
  rejected: 'border-2 border-red-500',
  pending: 'border-2 border-dashed border-yellow-400',
  none: 'border-2 border-dashed border-gray-300',
};

interface ManualReviewProps {
  sampleId: string;
}

export default function ManualReview({ sampleId }: ManualReviewProps) {
  const sample = useSampleById(sampleId);
  const existingReview = useReviewForSample(sampleId);
  const submitReview = useStore((s) => s.submitReview);

  const [action, setAction] = useState<ReviewAction | null>(
    existingReview?.action ?? null
  );
  const [note, setNote] = useState(existingReview?.note ?? '');

  if (!sample) return null;

  const borderClass = existingReview
    ? BORDER_MAP[existingReview.action]
    : BORDER_MAP.none;

  const handleSubmit = () => {
    if (!action) return;
    submitReview(sampleId, action, note, '当前用户');
  };

  return (
    <div className={cn('rounded-xl p-4 bg-white', borderClass)}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-900">人工审核</h3>
        {existingReview && (
          <span className="text-xs text-gray-400">
            {new Date(existingReview.timestamp).toLocaleString('zh-CN')}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 mb-4">
        <span>线路：{sample.lineName}</span>
        <span>日期：{sample.date}</span>
        <span>时段：{sample.timePeriod}</span>
      </div>

      {existingReview ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {existingReview.action === 'approved' && (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            )}
            {existingReview.action === 'rejected' && (
              <XCircle className="h-4 w-4 text-red-500" />
            )}
            {existingReview.action === 'pending' && (
              <Clock className="h-4 w-4 text-yellow-500" />
            )}
            <span className="text-sm font-semibold text-gray-800">
              {ACTION_CONFIG[existingReview.action].label}
            </span>
            <span className="text-xs text-gray-400">
              审核人：{existingReview.operator}
            </span>
          </div>
          {existingReview.note && (
            <p className="text-sm text-gray-600 bg-gray-50 rounded px-3 py-2">
              {existingReview.note}
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="flex gap-2 mb-3">
            {(Object.keys(ACTION_CONFIG) as ReviewAction[]).map((key) => {
              const cfg = ACTION_CONFIG[key];
              return (
                <button
                  key={key}
                  onClick={() => setAction(key)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                    cfg.color,
                    action === key ? 'ring-2 ring-offset-1 ring-gray-400' : 'opacity-70'
                  )}
                >
                  {cfg.icon}
                  {cfg.label}
                </button>
              );
            })}
          </div>

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="输入审核备注（可选）"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-teal-400 mb-3"
            rows={2}
          />

          <button
            onClick={handleSubmit}
            disabled={!action}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              action
                ? 'bg-[#0F4C5C] text-white hover:bg-[#0d3f4d]'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            )}
          >
            <Send className="h-3.5 w-3.5" />
            提交审核
          </button>
        </>
      )}
    </div>
  );
}
