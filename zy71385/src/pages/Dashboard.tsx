import { useState, useEffect } from 'react';
import { Search, Filter, Download, Upload, CheckSquare, Square, Eye, Trash2, RefreshCw, Flag, Shield, AlertTriangle, TrendingUp } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { useFlagStore } from '../store/flagStore';
import { StatsCard } from '../components/StatsCard';
import { RiskBadge } from '../components/RiskBadge';
import { StatusBadge } from '../components/StatusBadge';
import { Pagination } from '../components/Pagination';
import { ImportModal } from '../components/ImportModal';
import { FlagDetailModal } from '../components/FlagDetailModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { formatDate } from '../utils/dateUtils';
import type { FlagWithDetails, RiskLevel } from '../types';

const RISK_COLORS: Record<RiskLevel, string> = {
  low: '#10B981',
  medium: '#F59E0B',
  high: '#EF4444',
  blocker: '#DC2626',
};

export function Dashboard() {
  const {
    flags,
    initData,
    getPaginatedFlags,
    getTotalPages,
    getStatistics,
    pagination,
    setPagination,
    searchQuery,
    setSearchQuery,
    filters,
    setFilters,
    selectedFlags,
    toggleFlagSelection,
    selectAllFlags,
    clearSelection,
    setShowImportModal,
    loading,
    deleteFlag,
    reAssessAll,
    runScan,
    exportFlags,
  } = useFlagStore();

  const [selectedFlagDetail, setSelectedFlagDetail] = useState<FlagWithDetails | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  useEffect(() => {
    initData();
  }, [initData]);

  const stats = getStatistics();
  const paginatedFlags = getPaginatedFlags();
  const totalPages = getTotalPages();
  const filteredCount = useFlagStore.getState().getFilteredFlags().length;

  const chartData = Object.entries(stats.byRiskLevel).map(([level, count]) => ({
    name: level === 'low' ? '低风险' : level === 'medium' ? '中风险' : level === 'high' ? '高风险' : '阻塞',
    value: count,
    color: RISK_COLORS[level as RiskLevel],
  }));

  const handleDelete = (flagId: string) => {
    deleteFlag(flagId);
    setDeleteConfirm(null);
  };

  const handleBulkDelete = () => {
    selectedFlags.forEach(id => deleteFlag(id));
    clearSelection();
  };

  const handleExport = () => {
    exportFlags('xlsx', selectedFlags.length > 0 ? selectedFlags : undefined);
  };

  const allSelected = paginatedFlags.length > 0 && paginatedFlags.every(f => selectedFlags.includes(f.id));

  return (
    <div className="space-y-6">
      {loading && <LoadingOverlay message="正在处理..." />}
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">功能开关总览</h1>
          <p className="text-gray-500 mt-1">管理和清理所有功能开关，降低技术债务</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowImportModal(true)} className="btn-secondary flex items-center gap-2">
            <Upload className="w-4 h-4" />
            导入
          </button>
          <button onClick={handleExport} className="btn-secondary flex items-center gap-2">
            <Download className="w-4 h-4" />
            导出
          </button>
          <button onClick={() => runScan()} className="btn-secondary flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            重新扫描
          </button>
          <button onClick={() => reAssessAll()} className="btn-primary flex items-center gap-2">
            <Shield className="w-4 h-4" />
            重新评估
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-6">
        <StatsCard
          title="总开关数"
          value={stats.total}
          icon={<Flag className="w-6 h-6" />}
          color="blue"
          trend="+2 本月"
        />
        <StatsCard
          title="可安全清理"
          value={stats.safeToDelete}
          icon={<TrendingUp className="w-6 h-6" />}
          color="green"
          trend="建议优先处理"
        />
        <StatsCard
          title="高风险/阻塞"
          value={stats.highRisk}
          icon={<AlertTriangle className="w-6 h-6" />}
          color="red"
          trend="需要人工核查"
        />
        <StatsCard
          title="待清理"
          value={stats.pending}
          icon={<Trash2 className="w-6 h-6" />}
          color="orange"
        />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">风险分布</h2>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">快速筛选</h2>
          <div className="space-y-2">
            {(['low', 'medium', 'high', 'blocker'] as RiskLevel[]).map(level => (
              <button
                key={level}
                onClick={() => {
                  const current = filters.riskLevel || [];
                  if (current.includes(level)) {
                    setFilters({ riskLevel: current.filter(l => l !== level) });
                  } else {
                    setFilters({ riskLevel: [...current, level] });
                  }
                }}
                className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                  filters.riskLevel?.includes(level)
                    ? 'bg-primary-50 border border-primary-200'
                    : 'hover:bg-gray-50 border border-transparent'
                }`}
              >
                <RiskBadge level={level} />
                <span className="text-sm font-medium text-gray-600">
                  {stats.byRiskLevel[level]} 个
                </span>
              </button>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <button
              onClick={() => setFilters({ riskLevel: undefined })}
              className="text-sm text-primary-600 hover:text-primary-700"
            >
              重置筛选
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="搜索开关名称、Key、负责人..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field pl-10 w-96"
              />
            </div>
            <button
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              className={`btn-secondary flex items-center gap-2 ${
                showFilterPanel ? 'bg-primary-50 border-primary-200' : ''
              }`}
            >
              <Filter className="w-4 h-4" />
              高级筛选
            </button>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">
              已选择 {selectedFlags.length} 项 / 共 {filteredCount} 项
            </span>
            {selectedFlags.length > 0 && (
              <button onClick={clearSelection} className="text-sm text-primary-600 hover:text-primary-700">
                清除选择
              </button>
            )}
          </div>
        </div>

        {showFilterPanel && (
          <div className="mb-4 p-4 bg-gray-50 rounded-xl animate-fade-in">
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
                <select
                  className="input-field"
                  onChange={(e) => {
                    if (e.target.value) {
                      setFilters({ status: [e.target.value as any] });
                    } else {
                      setFilters({ status: undefined });
                    }
                  }}
                >
                  <option value="">全部</option>
                  <option value="active">运行中</option>
                  <option value="inactive">已停用</option>
                  <option value="deprecated">已废弃</option>
                  <option value="pending_cleanup">待清理</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">代码引用</label>
                <select
                  className="input-field"
                  onChange={(e) => {
                    if (e.target.value === 'has') {
                      setFilters({ hasCodeReferences: true });
                    } else if (e.target.value === 'none') {
                      setFilters({ hasCodeReferences: false });
                    } else {
                      setFilters({ hasCodeReferences: undefined });
                    }
                  }}
                >
                  <option value="">全部</option>
                  <option value="has">有引用</option>
                  <option value="none">无引用</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">灰度用户</label>
                <select
                  className="input-field"
                  onChange={(e) => {
                    if (e.target.value === 'has') {
                      setFilters({ hasGrayUsers: true });
                    } else if (e.target.value === 'none') {
                      setFilters({ hasGrayUsers: false });
                    } else {
                      setFilters({ hasGrayUsers: undefined });
                    }
                  }}
                >
                  <option value="">全部</option>
                  <option value="has">有灰度用户</option>
                  <option value="none">无灰度用户</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">每页显示</label>
                <select
                  className="input-field"
                  value={pagination.pageSize}
                  onChange={(e) => setPagination({ pageSize: Number(e.target.value), page: 1 })}
                >
                  <option value={10}>10 条/页</option>
                  <option value={20}>20 条/页</option>
                  <option value={50}>50 条/页</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {selectedFlags.length > 0 && (
          <div className="mb-4 p-4 bg-primary-50 rounded-xl flex items-center justify-between">
            <span className="text-primary-700">
              已选择 <strong>{selectedFlags.length}</strong> 个开关
            </span>
            <div className="flex items-center gap-3">
              <button onClick={handleBulkDelete} className="btn-danger flex items-center gap-2">
                <Trash2 className="w-4 h-4" />
                批量清理
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="table-header w-12">
                  <button onClick={selectAllFlags} className="p-1">
                    {allSelected ? (
                      <CheckSquare className="w-4 h-4 text-primary-600" />
                    ) : (
                      <Square className="w-4 h-4 text-gray-300" />
                    )}
                  </button>
                </th>
                <th className="table-header">开关名称</th>
                <th className="table-header">负责人</th>
                <th className="table-header">上线日期</th>
                <th className="table-header">状态</th>
                <th className="table-header">风险等级</th>
                <th className="table-header">代码引用</th>
                <th className="table-header">灰度用户</th>
                <th className="table-header w-32">操作</th>
              </tr>
            </thead>
            <tbody>
              {paginatedFlags.map((flag) => (
                <tr key={flag.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="table-cell">
                    <button onClick={() => toggleFlagSelection(flag.id)} className="p-1">
                      {selectedFlags.includes(flag.id) ? (
                        <CheckSquare className="w-4 h-4 text-primary-600" />
                      ) : (
                        <Square className="w-4 h-4 text-gray-300" />
                      )}
                    </button>
                  </td>
                  <td className="table-cell">
                    <div>
                      <p className="font-medium text-gray-900">{flag.name}</p>
                      <p className="text-xs text-gray-400 font-mono">{flag.key}</p>
                    </div>
                  </td>
                  <td className="table-cell">
                    <span className={flag.owner ? 'text-gray-700' : 'text-risk-medium'}>
                      {flag.owner || '-'}
                    </span>
                  </td>
                  <td className="table-cell">
                    {flag.launchDate ? formatDate(flag.launchDate) : '-'}
                  </td>
                  <td className="table-cell">
                    <StatusBadge status={flag.status} />
                  </td>
                  <td className="table-cell">
                    {flag.riskLevel && <RiskBadge level={flag.riskLevel} />}
                  </td>
                  <td className="table-cell">
                    <span className={`text-sm font-medium ${
                      flag.codeReferences.length > 0 ? 'text-gray-700' : 'text-risk-low'
                    }`}>
                      {flag.codeReferences.length > 0
                        ? `${flag.codeReferences.length} 处`
                        : '无引用'}
                    </span>
                  </td>
                  <td className="table-cell">
                    <span className={`text-sm font-medium ${
                      Math.max(...flag.environmentStatuses.map(e => e.grayUsers), 0) > 0
                        ? 'text-risk-medium'
                        : 'text-gray-500'
                    }`}>
                      {Math.max(...flag.environmentStatuses.map(e => e.grayUsers), 0) > 0
                        ? `${Math.max(...flag.environmentStatuses.map(e => e.grayUsers))} 人`
                        : '无'}
                    </span>
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setSelectedFlagDetail(flag)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        title="查看详情"
                      >
                        <Eye className="w-4 h-4 text-gray-400" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(flag.id)}
                        className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={pagination.page}
          totalPages={totalPages}
          onPageChange={(page) => setPagination({ page })}
        />
      </div>

      <ImportModal />
      
      {selectedFlagDetail && (
        <FlagDetailModal
          flag={selectedFlagDetail}
          onClose={() => setSelectedFlagDetail(null)}
        />
      )}

      <ConfirmModal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)}
        title="确认删除"
        message="确定要删除这个功能开关吗？此操作将记录在操作日志中，并可以通过历史记录回滚。"
        confirmText="确认删除"
        variant="danger"
      />
    </div>
  );
}
