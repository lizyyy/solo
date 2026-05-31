import { useNavigate } from 'react-router-dom';
import { Search, Filter, AlertTriangle, Clock, GitCompare, FileDown, Eye } from 'lucide-react';
import { useExperiments } from '@/hooks/useExperiments';
import { DataTable } from '@/components/DataTable';
import { ExperimentStatusBadge } from '@/components/StatusBadge';
import { formatDate, formatTime } from '@/utils/date';
import type { Experiment } from '@/types';

export function ExperimentList() {
  const navigate = useNavigate();
  const { filters, setFilters, getFilteredExperiments } = useExperiments();
  const experiments = getFilteredExperiments();

  const columns = [
    {
      key: 'experimentDate',
      header: '日期',
      width: '110px',
      render: (item: Experiment) => (
        <div className="font-mono text-sm">{formatDate(item.experimentDate)}</div>
      ),
    },
    {
      key: 'className',
      header: '班级',
      width: '140px',
    },
    {
      key: 'studentName',
      header: '学生',
      width: '100px',
      render: (item: Experiment) => (
        <div>
          <div className="font-medium">{item.studentName}</div>
          <div className="text-xs text-neutral-500 font-mono">{item.studentId}</div>
        </div>
      ),
    },
    {
      key: 'status',
      header: '状态',
      width: '110px',
      render: (item: Experiment) => <ExperimentStatusBadge status={item.status} />,
    },
    {
      key: 'timing',
      header: '数据到达时间',
      width: '240px',
      render: (item: Experiment) => (
        <div className="text-xs space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-blue-600 font-medium">[学生记录]</span>
            <span className="text-neutral-600">
              {formatTime(item.studentRecordArrivedAt)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-600 font-medium">[评分表]</span>
            <span className="text-neutral-600">
              {item.scoreSheetArrivedAt ? formatTime(item.scoreSheetArrivedAt) : (
                <span className="text-orange-600 font-medium">未到达</span>
              )}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'anomalies',
      header: '异常/待补',
      width: '100px',
      render: (item: Experiment) => (
        <div className="flex items-center gap-3">
          {item.anomalyCount > 0 && (
            <div className="flex items-center gap-1 text-red-600">
              <AlertTriangle size={14} />
              <span className="text-sm font-medium">{item.anomalyCount}</span>
            </div>
          )}
          {item.pendingCount > 0 && (
            <div className="flex items-center gap-1 text-orange-600">
              <Clock size={14} />
              <span className="text-sm font-medium">{item.pendingCount}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '操作',
      width: '200px',
      render: (item: Experiment) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/experiments/${item.id}`);
            }}
            className="flex items-center gap-1 px-2 py-1 text-xs text-primary hover:bg-primary/10 rounded transition-colors"
          >
            <Eye size={14} />
            详情
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/experiments/${item.id}/timeline`);
            }}
            className="flex items-center gap-1 px-2 py-1 text-xs text-primary hover:bg-primary/10 rounded transition-colors"
          >
            <GitCompare size={14} />
            时序
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/experiments/${item.id}/anomalies`);
            }}
            className="flex items-center gap-1 px-2 py-1 text-xs text-primary hover:bg-primary/10 rounded transition-colors"
          >
            <AlertTriangle size={14} />
            异常
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/export?id=${item.id}`);
            }}
            className="flex items-center gap-1 px-2 py-1 text-xs text-primary hover:bg-primary/10 rounded transition-colors"
          >
            <FileDown size={14} />
            导出
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-mono font-semibold text-neutral-900">实验列表</h2>
        <div className="text-sm text-neutral-500">
          共 <span className="font-mono font-semibold text-primary">{experiments.length}</span> 条记录
        </div>
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={16} className="text-neutral-500" />
          <span className="text-sm font-medium text-neutral-700">筛选条件</span>
        </div>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">班级</label>
            <input
              type="text"
              placeholder="输入班级名称"
              value={filters.className}
              onChange={(e) => setFilters({ className: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-neutral-300 rounded focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">状态</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ status: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-neutral-300 rounded focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            >
              <option value="">全部状态</option>
              <option value="normal">正常</option>
              <option value="pending_score">待补评分表</option>
              <option value="has_anomaly">有异常</option>
              <option value="incomplete">不完整</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">开始日期</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({ dateFrom: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-neutral-300 rounded focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">结束日期</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({ dateTo: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-neutral-300 rounded focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-4">
        <div className="flex items-center gap-6 text-xs text-neutral-600 mb-4 pb-4 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            <Search size={14} />
            <span>点击行查看详情</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
            <span>正常</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
            <span>待补评分表</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span>有异常</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-gray-500" />
            <span>不完整</span>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={experiments}
          onRowClick={(item) => navigate(`/experiments/${item.id}`)}
          emptyMessage="暂无实验记录"
        />
      </div>
    </div>
  );
}
