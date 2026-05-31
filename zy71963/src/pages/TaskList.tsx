import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, PlayCircle, CheckCircle2, Archive, Search, Filter, Eye, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { useTaskStore } from '../store/taskStore';
import { TaskStatus, TaskSource, TaskStatusLabels, TaskSourceLabels } from '../types';
import { StatusBadge, SourceBadge } from '../components/StatusBadge';
import { StatCard } from '../components/StatCard';

export function TaskList() {
  const navigate = useNavigate();
  const { tasks } = useTaskStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<TaskSource | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);

  const stats = useMemo(() => {
    return {
      pending: tasks.filter((t) => t.status === 'pending').length,
      inProgress: tasks.filter((t) => t.status === 'in_progress').length,
      completed: tasks.filter((t) => t.status === 'completed').length,
      archived: tasks.filter((t) => t.status === 'archived').length,
    };
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesSearch =
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.assignee.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
      const matchesSource = sourceFilter === 'all' || task.source === sourceFilter;
      return matchesSearch && matchesStatus && matchesSource;
    });
  }, [tasks, searchQuery, statusFilter, sourceFilter]);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">训练任务排队</h1>
        <p className="text-gray-500">查看和管理所有训练任务，追踪修改历史</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard title="待处理" value={stats.pending} icon={Clock} color="amber" />
        <StatCard title="进行中" value={stats.inProgress} icon={PlayCircle} color="primary" />
        <StatCard title="已完成" value={stats.completed} icon={CheckCircle2} color="emerald" />
        <StatCard title="已归档" value={stats.archived} icon={Archive} color="gray" />
      </div>

      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="搜索任务ID、标题、负责人..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Filter className="w-4 h-4" />
              筛选
              <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">状态</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as TaskStatus | 'all')}
                  className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="all">全部</option>
                  {Object.entries(TaskStatusLabels).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">来源</label>
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value as TaskSource | 'all')}
                  className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="all">全部</option>
                  {Object.entries(TaskSourceLabels).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">任务</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">来源</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">负责人</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">更新时间</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredTasks.map((task) => (
                <tr
                  key={task.id}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/tasks/${task.id}`)}
                >
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{task.title}</div>
                      <div className="text-xs text-gray-500">{task.id}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <SourceBadge source={task.source} />
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={task.status} />
                    {task.pendingReason && (
                      <div className="text-xs text-gray-500 mt-1 max-w-xs truncate">
                        {task.pendingReason}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{task.assignee}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {format(new Date(task.updatedAt), 'MM-dd HH:mm', { locale: zhCN })}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/tasks/${task.id}`);
                      }}
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredTasks.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    没有找到匹配的任务
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
