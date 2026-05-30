import type { SettlementTask } from '@/types';
import { useNavigate } from 'react-router-dom';
import StatusBadge from './StatusBadge';
import { formatCurrency, formatDate } from '@/utils/format';
import { AlertTriangle, ChevronRight } from 'lucide-react';

interface TaskCardProps {
  task: SettlementTask;
}

export default function TaskCard({ task }: TaskCardProps) {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(`/task/${task.id}`)}
      className="bg-white rounded-lg border border-zinc-200 p-5 cursor-pointer hover:shadow-md hover:border-zinc-300 transition-all animate-fadeInUp"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-zinc-900 truncate">{task.name}</h3>
          <p className="text-xs text-zinc-500 mt-1">
            {formatDate(task.periodStart)} ~ {formatDate(task.periodEnd)}
          </p>
        </div>
        <div className="flex items-center gap-2 ml-3 shrink-0">
          {task.status === 'pending_material' && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-600 border border-amber-200">
              续办中
            </span>
          )}
          <StatusBadge status={task.status} />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mt-4">
        <div>
          <p className="text-xs text-zinc-400">总票房</p>
          <p className="text-sm font-mono font-semibold text-zinc-800 mt-0.5">{formatCurrency(task.totalGross)}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-400">退票</p>
          <p className="text-sm font-mono font-semibold text-zinc-800 mt-0.5">{formatCurrency(task.totalRefund)}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-400">券抵扣</p>
          <p className="text-sm font-mono font-semibold text-zinc-800 mt-0.5">{formatCurrency(task.totalCoupon)}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-400">净票房</p>
          <p className="text-sm font-mono font-semibold text-zinc-800 mt-0.5">{formatCurrency(task.netGross)}</p>
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-zinc-100">
        <div className="flex items-center gap-2">
          {task.errorCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-600">
              <AlertTriangle size={12} />
              {task.errorCount} 条异常
            </span>
          )}
          {task.currentVersion && (
            <span className="text-xs text-zinc-400">v{task.currentVersion}</span>
          )}
        </div>
        <ChevronRight size={16} className="text-zinc-400" />
      </div>
    </div>
  );
}
