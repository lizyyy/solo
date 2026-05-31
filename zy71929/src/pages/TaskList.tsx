import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  Filter,
  Clock,
  AlertTriangle,
  Eye,
  CheckCircle,
  User,
  RefreshCw,
  X,
} from 'lucide-react';
import { useAppStore } from '@/store';
import { getStatusLabel, getStatusColor, formatDate, curatorNoteTemplate } from '@/utils';
import type { TaskStatus } from '@/types';

const statusFilters: { value: TaskStatus | 'all'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'waiting_artworks', label: '等待作品' },
  { value: 'pending', label: '待处理' },
  { value: 'reviewing', label: '复核中' },
  { value: 'completed', label: '已完成' },
];

const getStatusIcon = (status: TaskStatus) => {
  switch (status) {
    case 'waiting_artworks':
      return Clock;
    case 'pending':
      return AlertTriangle;
    case 'reviewing':
      return Eye;
    case 'completed':
      return CheckCircle;
  }
};

export default function TaskList() {
  const navigate = useNavigate();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTask, setNewTask] = useState({
    source: '',
    title: '',
    curatorNote: curatorNoteTemplate(),
  });
  const [isDuplicate, setIsDuplicate] = useState(false);

  const searchQuery = useAppStore((state) => state.searchQuery);
  const statusFilter = useAppStore((state) => state.statusFilter);
  const tasks = useAppStore((state) => state.tasks);
  const setSearchQuery = useAppStore((state) => state.setSearchQuery);
  const setStatusFilter = useAppStore((state) => state.setStatusFilter);
  const createTask = useAppStore((state) => state.createTask);

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch =
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.source.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCreateTask = () => {
    if (!newTask.source || !newTask.title || !newTask.curatorNote) {
      return;
    }

    const task = createTask(newTask.source, newTask.title, newTask.curatorNote);
    
    if (task) {
      setIsDuplicate(task.executionCount > 1);
      if (!isDuplicate) {
        setShowCreateModal(false);
        setNewTask({ source: '', title: '', curatorNote: curatorNoteTemplate() });
      }
      navigate(`/tasks/${task.id}`);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex-1 flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ivory-400" />
            <input
              type="text"
              placeholder="搜索任务标题或来源..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-charcoal-400/80 border border-charcoal-200/50 rounded-md text-ivory-100 placeholder-ivory-500 focus:outline-none focus:border-gold-300/50 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-ivory-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as TaskStatus | 'all')}
              className="px-4 py-2.5 bg-charcoal-400/80 border border-charcoal-200/50 rounded-md text-ivory-100 focus:outline-none focus:border-gold-300/50 transition-colors cursor-pointer"
            >
              {statusFilters.map((filter) => (
                <option key={filter.value} value={filter.value}>
                  {filter.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          新建投屏任务
        </button>
      </div>

      <div className="grid gap-4">
        {filteredTasks.map((task, index) => {
          const StatusIcon = getStatusIcon(task.status);
          return (
            <div
              key={task.id}
              className="card card-hover p-6 cursor-pointer animate-fade-in-up"
              style={{ animationDelay: `${index * 0.05}s` }}
              onClick={() => navigate(`/tasks/${task.id}`)}
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-serif text-lg text-ivory-100">{task.title}</h3>
                    <span
                      className={`status-badge border ${getStatusColor(task.status)}`}
                    >
                      <StatusIcon className="w-3 h-3 inline mr-1" />
                      {getStatusLabel(task.status)}
                    </span>
                    {task.executionCount > 1 && (
                      <span className="flex items-center gap-1 text-xs text-gold-300 bg-gold-300/10 px-2 py-1 rounded">
                        <RefreshCw className="w-3 h-3" />
                        第 {task.executionCount} 次执行
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-ivory-400 mb-3">
                    来源: {task.source}
                  </p>
                  <p className="text-sm text-ivory-300 line-clamp-2">
                    {task.curatorNote.substring(0, 150)}...
                  </p>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end gap-4 text-sm">
                  <div className="flex items-center gap-2 text-ivory-400">
                    <Clock className="w-4 h-4" />
                    <span>{formatDate(task.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-ivory-400">
                    <User className="w-4 h-4" />
                    <span>{task.updatedBy}</span>
                  </div>
                </div>
              </div>

              {task.status === 'pending' && task.pendingReason && (
                <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-md">
                  <p className="text-sm text-amber-300">
                    <AlertTriangle className="w-4 h-4 inline mr-2" />
                    待处理原因: {task.pendingReason}
                  </p>
                </div>
              )}
            </div>
          );
        })}

        {filteredTasks.length === 0 && (
          <div className="card p-12 text-center">
            <div className="w-16 h-16 bg-charcoal-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-ivory-400" />
            </div>
            <p className="text-ivory-300">没有找到匹配的任务</p>
            <p className="text-sm text-ivory-500 mt-1">
              尝试调整搜索条件或筛选状态
            </p>
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-2xl max-h-[90vh] overflow-auto animate-fade-in-up">
            <div className="p-6 border-b border-charcoal-200/50 flex items-center justify-between">
              <h3 className="font-serif text-xl text-ivory-100">新建投屏任务</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 hover:bg-charcoal-200 rounded-md transition-colors"
              >
                <X className="w-5 h-5 text-ivory-300" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-ivory-200 mb-2">
                  来源 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="例如：邮件-20240520、微信-策展群"
                  value={newTask.source}
                  onChange={(e) => setNewTask({ ...newTask, source: e.target.value })}
                  className="w-full px-4 py-2.5 bg-charcoal-400/80 border border-charcoal-200/50 rounded-md text-ivory-100 placeholder-ivory-500 focus:outline-none focus:border-gold-300/50 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ivory-200 mb-2">
                  展览标题 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="输入展览标题"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  className="w-full px-4 py-2.5 bg-charcoal-400/80 border border-charcoal-200/50 rounded-md text-ivory-100 placeholder-ivory-500 focus:outline-none focus:border-gold-300/50 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ivory-200 mb-2">
                  策展备注 <span className="text-red-400">*</span>
                </label>
                <textarea
                  rows={10}
                  placeholder="输入策展备注..."
                  value={newTask.curatorNote}
                  onChange={(e) => setNewTask({ ...newTask, curatorNote: e.target.value })}
                  className="w-full px-4 py-3 bg-charcoal-400/80 border border-charcoal-200/50 rounded-md text-ivory-100 placeholder-ivory-500 focus:outline-none focus:border-gold-300/50 transition-colors font-mono text-sm"
                />
                <p className="text-xs text-ivory-500 mt-2">
                  提示：系统会自动检测重复材料，相同内容再次提交时会复用历史记录
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-charcoal-200/50 flex justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="btn-secondary"
              >
                取消
              </button>
              <button
                onClick={handleCreateTask}
                disabled={!newTask.source || !newTask.title || !newTask.curatorNote}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                创建任务
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
