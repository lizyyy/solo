import React, { useState, useMemo } from 'react';
import { Search, Filter, Clock, CheckCircle, XCircle, AlertTriangle, FileText, RefreshCw, Trash2 } from 'lucide-react';
import type { EstimationTask, Material } from '@/types';
import { formatNumber, formatTime } from '@/utils/math';

interface TaskHistoryProps {
  tasks: EstimationTask[];
  materials: Material[];
  selectedTaskIds: string[];
  onSelectTask: (taskId: string) => void;
  onLoadTask: (taskId: string) => void;
  onDeleteTask?: (taskId: string) => void;
  onCompare?: () => void;
}

const algorithmNames: Record<string, string> = {
  'quadric_edge_collapse': '二次误差边折叠',
  'clustering': '聚类简化',
  'vertex_clustering': '顶点聚类',
  'meshdecimator': '网格抽取'
};

const statusConfig = {
  completed: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50', label: '已完成' },
  failed: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-50', label: '失败' },
  pending: { icon: RefreshCw, color: 'text-blue-500', bg: 'bg-blue-50', label: '处理中' },
  duplicate: { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-50', label: '重复任务' }
};

export const TaskHistory: React.FC<TaskHistoryProps> = ({
  tasks,
  materials,
  selectedTaskIds,
  onSelectTask,
  onLoadTask,
  onDeleteTask,
  onCompare
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const getMaterialName = (materialId: string) => {
    return materials.find(m => m.id === materialId)?.name || '未知材料';
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const matchesSearch = task.modelName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [tasks, searchQuery, statusFilter]);

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">历史记录</h3>
        {selectedTaskIds.length >= 2 && onCompare && (
          <button
            onClick={onCompare}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
          >
            <FileText className="w-4 h-4" />
            对比 {selectedTaskIds.length} 个方案
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索模型名称..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">全部状态</option>
            <option value="completed">已完成</option>
            <option value="failed">失败</option>
            <option value="duplicate">重复任务</option>
          </select>
        </div>
      </div>

      {selectedTaskIds.length > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-2 text-sm text-purple-700">
          已选择 {selectedTaskIds.length} 个任务进行对比
        </div>
      )}

      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
            <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400">暂无历史记录</p>
            <p className="text-gray-300 text-sm mt-1">完成一次估计后记录将显示在这里</p>
          </div>
        ) : (
          filteredTasks.map((task) => {
            const status = statusConfig[task.status as keyof typeof statusConfig] || statusConfig.failed;
            const StatusIcon = status.icon;
            const isSelected = selectedTaskIds.includes(task.id);

            return (
              <div
                key={task.id}
                className={`p-4 rounded-xl border-2 transition-all ${
                  isSelected
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                } ${task.isDuplicate ? 'ring-2 ring-amber-400 ring-opacity-50' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onSelectTask(task.id)}
                    className="mt-1 w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-800 truncate">{task.modelName}</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${status.bg} ${status.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {status.label}
                      </span>
                      {task.isDuplicate && (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
                          重复检测
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-gray-500 flex-wrap">
                      <span>
                        {formatNumber(task.simplifiedFaces, 0)} 面
                        <span className="text-gray-400 mx-1">/</span>
                        {(task.simplificationRatio * 100).toFixed(0)}%
                      </span>
                      <span>{algorithmNames[task.algorithm] || task.algorithm}</span>
                      <span>{getMaterialName(task.materialId)}</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(task.createdAt)}
                      </span>
                    </div>
                    {task.status === 'failed' && task.errorMessage && (
                      <div className="mt-2 text-xs text-red-600 bg-red-50 rounded px-2 py-1">
                        {task.errorMessage}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onLoadTask(task.id)}
                      className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                      title="查看详情"
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                    {onDeleteTask && (
                      <button
                        onClick={() => onDeleteTask(task.id)}
                        className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg transition-colors"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="text-xs text-gray-400 text-center pt-2">
        共 {filteredTasks.length} 条记录
        {selectedTaskIds.length > 0 && ` · 已选 ${selectedTaskIds.length} 条`}
      </div>
    </div>
  );
};
