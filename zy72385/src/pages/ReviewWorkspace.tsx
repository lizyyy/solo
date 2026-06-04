import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  SearchCheck,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  User,
  ChevronRight,
  Filter,
  ChevronDown,
  Search,
  ArrowLeft,
  Info,
  FileText,
  Eye,
  MessageSquare,
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { cn } from '@/lib/utils';
import type { ReviewTask } from '../../shared/types';

export const ReviewWorkspace: React.FC = () => {
  const navigate = useNavigate();
  const { reviewTasks, loadReviewTasks, isLoading, resolveReviewTask, calculations, currentUser, screenshots, samplingIntervals, loadAllData } = useStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [selectedTask, setSelectedTask] = useState<ReviewTask | null>(null);
  const [resolutionText, setResolutionText] = useState('');
  const [markAsNormal, setMarkAsNormal] = useState(false);

  useEffect(() => {
    loadAllData();
  }, []);

  const filteredTasks = reviewTasks.filter((task) => {
    const calc = calculations.find(c => c.id === task.calculationId);
    const matchesSearch = calc?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const pendingCount = reviewTasks.filter(t => t.status === 'pending').length;
  const resolvedCount = reviewTasks.filter(t => t.status === 'resolved').length;

  const getTypeLabel: Record<string, string> = {
    missing_interval: '缺失采样间隔',
    data_anomaly: '数据异常',
    result_review: '结果复核',
  };

  const handleResolve = async () => {
    if (!selectedTask || !resolutionText.trim()) return;
    await resolveReviewTask(selectedTask.id, resolutionText, markAsNormal);
    setSelectedTask(null);
    setResolutionText('');
    setMarkAsNormal(false);
  };

  const getCalcName = (calcId: string) => {
    const calc = calculations.find(c => c.id === calcId);
    return calc?.name || '未知计算';
  };

  const stats = [
    { label: '待复核', value: pendingCount, icon: AlertTriangle, color: 'from-amber-500 to-orange-500', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
    { label: '已解决', value: resolvedCount, icon: CheckCircle, color: 'from-emerald-500 to-green-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
    { label: '已驳回', value: reviewTasks.filter(t => t.status === 'rejected').length, icon: XCircle, color: 'from-red-500 to-rose-500', bg: 'bg-red-500/10', border: 'border-red-500/30' },
    { label: '复核中', value: reviewTasks.filter(t => t.status === 'reviewing').length, icon: Clock, color: 'from-blue-500 to-cyan-500', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">加载复核任务中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-1">质检员复核工作区</h1>
          <p className="text-slate-400 text-sm">采样时间缺半小时，别急着归正常，留给质检员复核</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, idx) => (
          <div
            key={idx}
            className={cn(
              'p-5 rounded-2xl border transition-all hover:scale-[1.02]',
              stat.bg,
              stat.border
            )}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={cn(
                'w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center',
                stat.color
              )}>
                <stat.icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="text-xs text-slate-400">{stat.label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-2 mb-4">
          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-amber-300 font-medium mb-1">
              质检员复核工作区
            </p>
            <p className="text-xs text-amber-200/80">
              检测到采样时间缺半小时时，系统自动创建复核任务。请仔细核对原始维修群截图和采样间隔说明后再做判断，别急着归正常。
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="搜索计算名称或问题描述..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-sm focus:outline-none focus:border-cyan-500/50 w-72"
            />
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-10 pr-8 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-sm focus:outline-none focus:border-cyan-500/50 appearance-none cursor-pointer"
            >
              <option value="all">全部状态</option>
              <option value="pending">待处理</option>
              <option value="reviewing">处理中</option>
              <option value="resolved">已解决</option>
              <option value="rejected">已驳回</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
          </div>
        </div>

        <div className="space-y-3">
          {filteredTasks.length === 0 ? (
            <div className="text-center py-12 bg-slate-900/30 rounded-xl border border-slate-800">
              <SearchCheck className="w-16 h-16 mx-auto mb-4 text-slate-600" />
              <p className="text-slate-400">暂无复核任务</p>
            </div>
          ) : (
            filteredTasks.map((task) => {
              const calc = calculations.find(c => c.id === task.calculationId);
              return (
                <div
                  key={task.id}
                  className="p-5 bg-slate-800/30 border border-slate-700/50 rounded-xl hover:border-slate-600 transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-4">
                      <div className={cn(
                        'w-12 h-12 rounded-xl flex items-center justify-center shrink-0',
                        task.type === 'missing_interval' && 'bg-amber-500/20',
                        task.type === 'data_anomaly' && 'bg-red-500/20',
                        task.type === 'result_review' && 'bg-purple-500/20'
                      )}>
                        <AlertTriangle className={cn(
                          'w-6 h-6',
                          task.type === 'missing_interval' && 'text-amber-400',
                          task.type === 'data_anomaly' && 'text-red-400',
                          task.type === 'result_review' && 'text-purple-400'
                        )} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="font-semibold">{getTypeLabel[task.type] || task.type}</h3>
                          <StatusBadge status={task.status} />
                        </div>
                        <p className="text-sm text-slate-400 mb-2">
                          计算任务: <span className="text-slate-200">{getCalcName(task.calculationId)}</span>
                        </p>
                        <p className="text-sm text-slate-300 bg-slate-900/30 rounded-lg p-3">
                          {task.description}
                        </p>

                        {task.missingInterval && (
                          <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                            <div className="flex items-center gap-2 mb-1">
                              <Clock className="w-4 h-4 text-amber-400" />
                              <span className="text-xs font-medium text-amber-300">缺失详情</span>
                            </div>
                            <p className="text-xs text-amber-200/80">
                              {new Date(task.missingInterval.start).toLocaleString('zh-CN')} - {new Date(task.missingInterval.end).toLocaleString('zh-CN')}
                              <span className="ml-2 text-amber-300">({task.missingInterval.duration} 分钟)</span>
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-xs text-slate-500 mb-1">分配给</p>
                      <div className="flex items-center gap-2 justify-end">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center text-xs text-white">
                          {task.assignee.slice(0, 1)}
                        </div>
                        <span className="text-sm text-slate-300">{task.assignee}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-2">
                        创建于 {new Date(task.createdAt).toLocaleDateString('zh-CN')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-700/50">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => navigate(`/calculations/${task.calculationId}`)}
                        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        查看计算详情
                      </button>
                      {calc && (
                        <button
                          onClick={() => navigate(`/report/${task.calculationId}`)}
                          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          查看复盘报告
                        </button>
                      )}
                    </div>

                    {task.status === 'pending' && (
                      <button
                        onClick={() => {
                          setSelectedTask(task);
                          setResolutionText('');
                          setMarkAsNormal(false);
                        }}
                        className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg text-xs font-medium hover:from-cyan-400 hover:to-blue-500 transition-all flex items-center gap-1"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        处理复核
                      </button>
                    )}

                    {task.status === 'resolved' && task.resolution && (
                      <div className="text-right">
                        <p className="text-xs text-slate-500">处理结果: {task.resolution}</p>
                        <p className="text-xs text-emerald-400">
                          于 {new Date(task.resolvedAt!).toLocaleString('zh-CN')}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {selectedTask && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedTask(null)}>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[85vh] overflow-hidden animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-800">
              <h2 className="text-xl font-bold">处理复核任务</h2>
              <p className="text-sm text-slate-400 mt-1">
                {getTypeLabel[selectedTask.type] || selectedTask.type}
              </p>
            </div>

            <div className="flex-1 overflow-auto p-6 space-y-6">
              <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50">
              <p className="text-xs text-slate-500 mb-2">问题描述</p>
              <p className="text-sm text-slate-200">{selectedTask.description}</p>
              </div>

              {selectedTask.missingInterval && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span className="text-sm font-medium text-amber-300">缺失采样间隔</span>
                  </div>
                  <p className="text-sm text-amber-200">
                    {new Date(selectedTask.missingInterval.start).toLocaleString('zh-CN')} - {new Date(selectedTask.missingInterval.end).toLocaleString('zh-CN')}
                  </p>
                  <p className="text-xs text-amber-300/70 mt-1">
                    持续 {selectedTask.missingInterval.duration} 分钟
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  处理说明 <span className="text-amber-400">*</span>
                </label>
                <textarea
                  value={resolutionText}
                  onChange={(e) => setResolutionText(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-sm focus:outline-none focus:border-cyan-500/50"
                  rows={4}
                  placeholder="请详细说明复核结果和处理意见..."
                />
              </div>

              <div className="flex items-center gap-3 p-4 bg-slate-800/30 rounded-xl border border-slate-700/50">
                <input
                  type="checkbox"
                  id="markNormal"
                  checked={markAsNormal}
                  onChange={(e) => setMarkAsNormal(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500"
                />
                <label htmlFor="markNormal" className="text-sm text-slate-300">
                  <span className="block font-medium">标记为正常数据</span>
                  <span className="block text-xs text-slate-500 mt-0.5">
                    勾选后，该缺失间隔将被视为正常情况，不再显示警告</span>
                </label>
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300">
                  请仔细核对原始维修群截图和采样间隔说明后再做判断。采样时间缺半小时时，别急着归正常。
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-slate-800 flex justify-end gap-3">
              <button
                onClick={() => setSelectedTask(null)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleResolve}
                disabled={!resolutionText.trim()}
                className={cn(
                  'px-6 py-2.5 rounded-lg text-sm font-medium transition-all',
                  resolutionText.trim()
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:from-cyan-400 hover:to-blue-500 shadow-lg shadow-cyan-500/20'
                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                )}
              >
                确认处理
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
