import { useNavigate } from 'react-router-dom';
import { User, Layers, Clock, ChevronRight } from 'lucide-react';
import type { ExperimentBatch } from '@shared/types';
import { formatDateTime, getStatusLabel } from '@/lib/api';

interface BatchCardProps {
  batch: ExperimentBatch;
}

const statusClass: Record<ExperimentBatch['status'], string> = {
  pending: 'tag-pending',
  processing: 'tag-pending',
  completed: 'tag-completed',
  needs_review: 'tag-needs-review',
};

export function BatchCard({ batch }: BatchCardProps) {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(`/experiment/${batch.id}`)}
      className="card p-5 hover:shadow-elevated transition-all duration-300 cursor-pointer group"
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <h3 className="font-serif text-lg text-ink-800 group-hover:text-ink-900 transition-colors">
            {batch.studentName}
          </h3>
          <div className="flex items-center gap-2 mt-1 text-xs text-ink-400">
            <User size={12} />
            <span>{batch.studentId}</span>
            <span className="text-ink-200">|</span>
            <Layers size={12} />
            <span>{batch.materialId}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={`tag ${statusClass[batch.status]}`}>
            {getStatusLabel(batch.status)}
          </span>
          {batch.version > 1 && (
            <span className="tag tag-insufficient">
              <Layers size={10} className="mr-1" />
              第 {batch.version} 版
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-ink-100">
        <div className="flex items-center gap-1.5 text-xs text-ink-400">
          <Clock size={12} />
          <span>{formatDateTime(batch.createdAt)}</span>
        </div>
        <div className="flex items-center gap-1 text-ink-400 group-hover:text-ink-600 transition-colors">
          <span className="text-xs">查看详情</span>
          <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
    </div>
  );
}
