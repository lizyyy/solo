import { useAppStore } from '@/store';
import { Database, HardHat, RefreshCw } from 'lucide-react';

export default function Header() {
  const currentTask = useAppStore((state) => state.getCurrentTask());
  const tasks = useAppStore((state) => state.tasks);
  const setCurrentTask = useAppStore((state) => state.setCurrentTask);
  const isLoading = useAppStore((state) => state.isLoading);

  return (
    <header className="h-16 bg-primary-800/60 border-b-2 border-primary-700 flex items-center justify-between px-6 backdrop-blur-sm">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <HardHat className="text-primary-400" size={24} />
          <div>
            <h2 className="font-mono text-sm font-medium text-primary-200">
              当前任务
            </h2>
            {currentTask ? (
              <p className="font-mono text-xs text-primary-300">
                {currentTask.taskNo} - {currentTask.projectName}
              </p>
            ) : (
              <p className="font-mono text-xs text-primary-400">
                未选择任务
              </p>
            )}
          </div>
        </div>

        {tasks.length > 1 && (
          <select
            value={currentTask?.id || ''}
            onChange={(e) => setCurrentTask(e.target.value || null)}
            className="input-industrial text-xs max-w-xs"
          >
            <option value="">-- 切换任务 --</option>
            {tasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.taskNo} - {task.projectName}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-xs font-mono text-primary-300">
          <Database size={14} />
          <span>任务数: {tasks.length}</span>
        </div>
        {currentTask && (
          <div className="flex items-center gap-2 text-xs font-mono text-primary-300">
            <span>标记数: {currentTask.marks.length}</span>
            {currentTask.conflicts.length > 0 && (
              <span className="text-accent-warning">
                冲突: {currentTask.conflicts.filter(c => c.status === 'pending').length}
              </span>
            )}
            {currentTask.abnormalities.length > 0 && (
              <span className="text-accent-warning">
                异常: {currentTask.abnormalities.filter(a => a.reviewStatus === 'pending').length}
              </span>
            )}
          </div>
        )}
        {isLoading && (
          <RefreshCw className="animate-spin text-primary-400" size={16} />
        )}
      </div>
    </header>
  );
}
