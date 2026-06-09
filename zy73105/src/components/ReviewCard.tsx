import type { ReviewRecord } from '../types/review';
import { formatDate, hasLateAttachment, hasLayerIssue } from '../utils/statusMappings';
import { StatusBadge } from './StatusBadge';
import { FileWarning, Layers3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Props {
  review: ReviewRecord;
}

export function ReviewCard({ review }: Props) {
  const navigate = useNavigate();
  const late = hasLateAttachment(review.attachments);
  const layer = hasLayerIssue(review.layerIssues);

  return (
    <div
      onClick={() => navigate(`/review/${review.id}`)}
      className={`group cursor-pointer rounded-lg border bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-card-hover ${
        late && layer
          ? 'border-status-layer/40 border-l-4 border-l-status-layer'
          : late
            ? 'border-status-late/40 border-l-4 border-l-status-late'
            : layer
              ? 'border-status-layer/40 border-l-4 border-l-status-layer'
              : 'border-slate-200 border-l-4 border-l-transparent'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="mono text-[11px] font-semibold text-slate-400">
            {review.id} · {review.drawingNo}
          </div>
          <div className="mt-0.5 font-semibold text-slate-900 truncate pr-2">
            {review.projectName}
          </div>
        </div>
        <StatusBadge status={review.conclusionStatus} size="sm" />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {late && (
          <span className="inline-flex items-center gap-1 rounded-full bg-status-late/10 px-2 py-0.5 text-[10px] font-medium text-status-late">
            <FileWarning size={10} />
            晚到附件
          </span>
        )}
        {layer && (
          <span className="inline-flex items-center gap-1 rounded-full bg-status-layer/10 px-2 py-0.5 text-[10px] font-medium text-status-layer">
            <Layers3 size={10} />
            图层异常
          </span>
        )}
      </div>

      <div className="mt-3 line-clamp-2 text-xs text-slate-600 leading-relaxed">
        {review.currentOpinion}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[11px] text-slate-500">
        <span>
          送审 <span className="mono font-medium text-slate-700">{formatDate(review.submissionDate)}</span>
        </span>
        <span>
          {review.reviewer} · {formatDate(review.reviewDate)}
        </span>
      </div>
    </div>
  );
}
