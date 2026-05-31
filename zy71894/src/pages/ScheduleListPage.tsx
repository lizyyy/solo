import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useScheduleStore } from '@/store/useScheduleStore';
import StatusBadge from '@/components/StatusBadge';
import PriorityBadge from '@/components/PriorityBadge';
import SeverityBadge from '@/components/SeverityBadge';
import { cn } from '@/lib/utils';
import {
  Play,
  Eye,
  FileText,
  Search,
  Filter,
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronRight,
} from 'lucide-react';

export default function ScheduleListPage() {
  const navigate = useNavigate();
  const { schedules, isScheduling, schedulingProgress, runScheduling, getMaterialBatchInfo } =
    useScheduleStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedBatchId, setSelectedBatchId] = useState('');

  const statusOptions = [
    { value: 'all', label: '全部状态' },
    { value: 'scheduled', label: '已排程' },
    { value: 'completed', label: '已完成' },
    { value: 'warning', label: '有警告' },
    { value: 'failed', label: '未通过' },
  ];

  const availableBatches = Object.entries(
    useScheduleStore.getState().teamRecords.reduce((acc, tr) => {
      const info = getMaterialBatchInfo(tr.materialBatchId);
      if (info) {
        acc[tr.materialBatchId] = info;
      }
      return acc;
    }, {} as Record<string, { name: string; type: string }>)
  );

  const filteredSchedules = schedules.filter((s) => {
    const matchesSearch =
      s.materialBatchId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.materialType.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleRunScheduling = async () => {
    if (!selectedBatchId) return;
    try {
      const result = await runScheduling(selectedBatchId);
      navigate(`/schedule/${result.id}`);
    } catch (e) {
      console.error('Scheduling failed:', e);
    }
  };

  const handleViewDetail = (scheduleId: string) => {
    navigate(`/schedule/${scheduleId}`);
  };

  const handleViewReport = (scheduleId: string) => {
    navigate(`/report/${scheduleId}`);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-600" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4 text-blue-600" />;
    }
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-2xl font-mono font-bold text-industrial-900">
                风洞试验排程总表
              </h1>
              <p className="text-industrial-500 text-sm mt-1">
                管理所有风洞试验排程，支持追溯依据来源和导出巡检报告
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <select
                  value={selectedBatchId}
                  onChange={(e) => setSelectedBatchId(e.target.value)}
                  className="px-3 py-2 border border-industrial-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 min-w-[200px]"
                >
                  <option value="">选择材料批次</option>
                  {availableBatches.map(([id, info]) => (
                    <option key={id} value={id}>
                      {id} - {info.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleRunScheduling}
                  disabled={!selectedBatchId || isScheduling}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 text-sm font-medium text-white transition-all',
                    selectedBatchId && !isScheduling
                      ? 'bg-primary-700 hover:bg-primary-800 active:bg-primary-900'
                      : 'bg-industrial-400 cursor-not-allowed'
                  )}
                >
                  {isScheduling ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      排程中... {schedulingProgress}%
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      执行排程
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {isScheduling && (
            <div className="mt-4 bg-primary-50 border border-primary-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-primary-800">正在执行排程算法...</span>
                <span className="text-sm text-primary-600">{schedulingProgress}%</span>
              </div>
              <div className="w-full bg-primary-200 h-2">
                <div
                  className="bg-primary-600 h-2 transition-all duration-300"
                  style={{ width: `${schedulingProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-industrial-400" />
            <input
              type="text"
              placeholder="搜索批次号、材料类型..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-industrial-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-industrial-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-industrial-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-white border border-industrial-200 shadow-industrial">
          <table className="w-full">
            <thead>
              <tr className="bg-industrial-50 border-b border-industrial-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-industrial-600 uppercase tracking-wider">
                  批次号
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-industrial-600 uppercase tracking-wider">
                  材料类型
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-industrial-600 uppercase tracking-wider">
                  状态
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-industrial-600 uppercase tracking-wider">
                  优先级
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-industrial-600 uppercase tracking-wider">
                  警告
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-industrial-600 uppercase tracking-wider">
                  排程时间
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-industrial-600 uppercase tracking-wider">
                  运行次数
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-industrial-600 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-industrial-200">
              {filteredSchedules.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-industrial-500">
                    <p>暂无排程记录</p>
                    <p className="text-sm mt-1">选择材料批次并点击"执行排程"创建新排程</p>
                  </td>
                </tr>
              ) : (
                filteredSchedules.map((schedule) => {
                  const batchInfo = getMaterialBatchInfo(schedule.materialBatchId);
                  return (
                    <tr
                      key={schedule.id}
                      className="hover:bg-industrial-50 transition-colors cursor-pointer"
                      onClick={() => handleViewDetail(schedule.id)}
                    >
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(schedule.status)}
                          <span className="font-mono text-sm font-medium text-industrial-900">
                            {schedule.materialBatchId}
                          </span>
                        </div>
                        {batchInfo && (
                          <p className="text-xs text-industrial-500 mt-0.5 ml-6">
                            {batchInfo.name}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm text-industrial-700">
                        {schedule.materialType}
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge status={schedule.status} />
                      </td>
                      <td className="px-4 py-4">
                        <PriorityBadge priority={schedule.priority} />
                      </td>
                      <td className="px-4 py-4">
                        {schedule.warnings.length > 0 ? (
                          <div className="flex items-center gap-1">
                            <SeverityBadge
                              severity={
                                schedule.warnings.some((w) => w.severity === 'high')
                                  ? 'high'
                                  : schedule.warnings.some((w) => w.severity === 'medium')
                                  ? 'medium'
                                  : 'low'
                              }
                            />
                            <span className="text-xs text-industrial-500">
                              {schedule.warnings.length} 项
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-industrial-400">无</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm text-industrial-600">
                        {new Date(schedule.scheduleTime).toLocaleString('zh-CN', {
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={cn(
                            'inline-flex items-center px-2 py-0.5 text-xs font-medium',
                            schedule.runCount > 1
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-industrial-100 text-industrial-600'
                          )}
                        >
                          第 {schedule.runCount} 次
                          {schedule.isReRun && (
                            <RefreshCw className="w-3 h-3 ml-1" />
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewDetail(schedule.id);
                            }}
                            className="p-1.5 text-industrial-500 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                            title="查看详情"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewReport(schedule.id);
                            }}
                            className="p-1.5 text-industrial-500 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                            title="查看报告"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          <ChevronRight className="w-4 h-4 text-industrial-400" />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-industrial-500">
          <div className="flex items-center gap-4">
            <span>共 {filteredSchedules.length} 条记录</span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              已完成: {schedules.filter((s) => s.status === 'completed').length}
            </span>
            <span className="flex items-center gap-1">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              有警告: {schedules.filter((s) => s.status === 'warning').length}
            </span>
            <span className="flex items-center gap-1">
              <XCircle className="w-4 h-4 text-red-600" />
              未通过: {schedules.filter((s) => s.status === 'failed').length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
