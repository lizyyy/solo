import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Clock,
  User,
  ArrowRight,
  CheckCircle,
} from 'lucide-react';
import { useAppStore } from '@/store';
import { formatDate } from '@/utils';

export default function PendingCenter() {
  const navigate = useNavigate();
  const tasks = useAppStore((state) => state.tasks);
  const updateTaskStatus = useAppStore((state) => state.updateTaskStatus);
  const pendingTasks = tasks.filter((t) => t.status === 'pending');

  const handleResolve = (taskId: string) => {
    updateTaskStatus(taskId, 'reviewing', '策展人已处理待处理项，进入复核阶段');
  };

  const getWaitingTime = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) {
      return `${hours}小时${minutes}分钟`;
    }
    return `${minutes}分钟`;
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-xl text-ivory-100 mb-1">
            待处理中心
          </h2>
          <p className="text-sm text-ivory-400">
            需要策展人处理的问题任务
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-md">
          <AlertTriangle className="w-5 h-5 text-amber-300" />
          <span className="text-amber-300 font-medium">
            {pendingTasks.length} 个待处理
          </span>
        </div>
      </div>

      {pendingTasks.length > 0 ? (
        <div className="space-y-4">
          {pendingTasks.map((task) => (
            <div
              key={task.id}
              className="card p-6 border-l-4 border-l-amber-500"
            >
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-serif text-lg text-ivory-100">
                      {task.title}
                    </h3>
                    <span className="text-xs text-ivory-500 bg-charcoal-200 px-2 py-1 rounded">
                      {task.source}
                    </span>
                  </div>

                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-md p-4 mb-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-300 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-amber-200 font-medium mb-1">
                          待处理原因
                        </p>
                        <p className="text-amber-100 text-sm">
                          {task.pendingReason}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-sm text-ivory-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      等待时长: {getWaitingTime(task.updatedAt)}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      最后更新: {task.updatedBy}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {formatDate(task.updatedAt)}
                    </span>
                  </div>
                </div>

                <div className="flex sm:flex-col gap-3">
                  <button
                    onClick={() => handleResolve(task.id)}
                    className="btn-primary flex items-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    标记已处理
                  </button>
                  <button
                    onClick={() => navigate(`/tasks/${task.id}`)}
                    className="btn-secondary flex items-center gap-2"
                  >
                    查看详情
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-12 text-center">
          <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-emerald-300" />
          </div>
          <h3 className="font-serif text-xl text-ivory-100 mb-2">
            没有待处理任务
          </h3>
          <p className="text-ivory-400">
            所有任务都已处理完毕，继续保持！
          </p>
        </div>
      )}
    </div>
  );
}
