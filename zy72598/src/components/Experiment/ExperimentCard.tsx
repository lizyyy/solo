import { Experiment } from '@/types';
import { cn } from '@/lib/utils';
import { Clock, CheckCircle, AlertTriangle, FileQuestion } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ExperimentCardProps {
  experiment: Experiment;
  isSelected: boolean;
  onSelect: () => void;
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  draft: { label: '草稿', color: 'bg-gray-100 text-gray-700', icon: Clock },
  importing: { label: '导入中', color: 'bg-blue-100 text-blue-700', icon: Clock },
  notes_pending: { label: '待补笔记', color: 'bg-amber-100 text-amber-700', icon: FileQuestion },
  conflicts_found: { label: '有冲突', color: 'bg-red-100 text-red-700', icon: AlertTriangle },
  ready: { label: '待完成', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  completed: { label: '已完成', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
};

export const ExperimentCard = ({ experiment, isSelected, onSelect }: ExperimentCardProps) => {
  const navigate = useNavigate();
  const status = statusConfig[experiment.status] || statusConfig.draft;
  const StatusIcon = status.icon;

  return (
    <div
      onClick={onSelect}
      className={cn(
        'p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:shadow-md',
        isSelected
          ? 'border-blue-500 bg-blue-50 shadow-md'
          : 'border-gray-200 bg-white hover:border-blue-300'
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <h3
          className="font-semibold text-gray-900 truncate flex-1"
          style={{ fontFamily: "'Source Serif Pro', serif" }}
        >
          {experiment.name}
        </h3>
        <span className={cn('px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1', status.color)}>
          <StatusIcon className="w-3 h-3" />
          {status.label}
        </span>
      </div>
      <p className="text-xs text-gray-500 mb-3">ID: {experiment.id}</p>
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">
          创建于 {new Date(experiment.createdAt).toLocaleDateString()}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/experiment/${experiment.id}`);
          }}
          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
        >
          查看详情 →
        </button>
      </div>
    </div>
  );
};
