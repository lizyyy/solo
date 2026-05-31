import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, Download, Eye, RefreshCw, FileText } from 'lucide-react';
import { useRedemptionStore } from '@/store';
import StatusBadge from '@/components/StatusBadge';
import StatsCard from '@/components/StatsCard';
import {
  calculateStats,
  filterRedemptions,
  formatCurrency,
  formatDate,
  exportToCSV,
  downloadCSV,
  getExportFilename,
  getMaterialStatusText,
  hasAllMaterials,
  hasConflicts,
} from '@/utils';
import type { RedemptionStatus } from '@/types';
import { STATUS_LABELS } from '@/data/constants';

export default function List() {
  const navigate = useNavigate();
  const { redemptions, filters, setFilters, resetFilters, initialize, refreshMockData } = useRedemptionStore();
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    initialize();
  }, [initialize]);

  const stats = useMemo(() => calculateStats(redemptions), [redemptions]);
  const filteredList = useMemo(() => filterRedemptions(redemptions, filters), [redemptions, filters]);

  const handleExport = (status: RedemptionStatus | 'all') => {
    const content = exportToCSV(redemptions, status);
    if (content) {
      downloadCSV(content, getExportFilename(status));
    } else {
      alert(`${status === 'all' ? '全部' : STATUS_LABELS[status]}没有可导出的数据`);
    }
  };

  const handleExportAll = () => {
    handleExport('all');
    setTimeout(() => handleExport('confirmed'), 200);
    setTimeout(() => handleExport('pending'), 400);
    setTimeout(() => handleExport('manual'), 600);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-primary-700 font-display">基金赎回预约排队</h1>
              <p className="text-sm text-gray-500 mt-0.5">结算会计专用 · 材料核对工具</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => refreshMockData()}
                className="btn-ghost flex items-center gap-1.5"
                title="重置为示例数据"
              >
                <RefreshCw className="w-4 h-4" />
                重置数据
              </button>
              <div className="relative group">
                <button className="btn-primary flex items-center gap-1.5">
                  <Download className="w-4 h-4" />
                  导出清单
                </button>
                <div className="absolute right-0 mt-1 w-48 bg-white rounded shadow-lg border border-gray-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                  <button
                    onClick={handleExportAll}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 border-b border-gray-50"
                  >
                    一次性导出全部（4个文件）
                  </button>
                  <button
                    onClick={() => handleExport('all')}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                  >
                    导出全部数据
                  </button>
                  <button
                    onClick={() => handleExport('confirmed')}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-status-confirmed"
                  >
                    导出已确认
                  </button>
                  <button
                    onClick={() => handleExport('pending')}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-status-pending"
                  >
                    导出待补材料
                  </button>
                  <button
                    onClick={() => handleExport('manual')}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-status-manual"
                  >
                    导出人工改判
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-6">
        <div className="grid grid-cols-4 gap-4 mb-6">
          <StatsCard status="confirmed" count={stats.confirmed.count} amount={stats.confirmed.amount} />
          <StatsCard status="pending" count={stats.pending.count} amount={stats.pending.amount} />
          <StatsCard status="manual" count={stats.manual.count} amount={stats.manual.amount} />
          <StatsCard status="total" count={stats.total.count} amount={stats.total.amount} />
        </div>

        <div className="card mb-4">
          <div className="p-4 flex items-center justify-between border-b border-gray-100">
            <div className="flex items-center gap-4 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜索基金代码、名称、申请人、排队原因..."
                  value={filters.keyword}
                  onChange={(e) => setFilters({ keyword: e.target.value })}
                  className="input-field pl-10"
                />
              </div>
              <div className="flex items-center gap-2">
                {(['all', 'confirmed', 'pending', 'manual'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setFilters({ status: s })}
                    className={`px-3 py-1.5 text-sm rounded transition-colors ${
                      filters.status === s
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {s === 'all' ? '全部' : STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`btn-ghost flex items-center gap-1.5 ml-4 ${showFilters ? 'bg-primary-50' : ''}`}
            >
              <Filter className="w-4 h-4" />
              更多筛选
            </button>
          </div>

          {showFilters && (
            <div className="p-4 bg-gray-50 border-b border-gray-100 grid grid-cols-4 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">申请日期从</label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters({ dateFrom: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">申请日期至</label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters({ dateTo: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">最小金额(元)</label>
                <input
                  type="number"
                  placeholder="如：100000"
                  value={filters.minAmount}
                  onChange={(e) => setFilters({ minAmount: e.target.value })}
                  className="input-field"
                />
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">最大金额(元)</label>
                  <input
                    type="number"
                    placeholder="如：1000000"
                    value={filters.maxAmount}
                    onChange={(e) => setFilters({ maxAmount: e.target.value })}
                    className="input-field"
                  />
                </div>
                <button onClick={resetFilters} className="btn-ghost whitespace-nowrap">
                  重置
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                    序号
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    基金代码
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    基金名称
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    申请金额
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    申请日期
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    状态
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    材料情况
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    申请人
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredList.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-gray-400">
                      <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>没有符合条件的记录</p>
                    </td>
                  </tr>
                ) : (
                  filteredList.map((item, index) => {
                    const missing = !hasAllMaterials(item.materials);
                    const conflict = hasConflicts(item.materials);
                    return (
                      <tr
                        key={item.id}
                        className={`table-row ${index % 2 === 1 ? 'table-row-alt' : ''}`}
                      >
                        <td className="px-4 py-3 text-sm text-gray-500">{index + 1}</td>
                        <td className="px-4 py-3 text-sm font-mono text-primary-600">{item.fundCode}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 font-medium">{item.fundName}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium text-currency">
                          {formatCurrency(item.applyAmount)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 text-center">
                          {formatDate(item.applyDate)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <StatusBadge status={item.status} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`text-xs ${
                              missing ? 'text-status-pending' : conflict ? 'text-status-manual' : 'text-status-confirmed'
                            }`}
                          >
                            {getMaterialStatusText(item.materials)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 text-center">{item.applicant}</td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => navigate(`/detail/${item.id}`)}
                            className="text-primary-500 hover:text-primary-700 inline-flex items-center gap-1"
                          >
                            <Eye className="w-4 h-4" />
                            详情
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 text-sm text-gray-500">
            共 {filteredList.length} 条记录
            {filters.status !== 'all' ||
            filters.keyword ||
            filters.dateFrom ||
            filters.dateTo ||
            filters.minAmount ||
            filters.maxAmount
              ? ` （已筛选，总计 ${redemptions.length} 条）`
              : ''}
          </div>
        </div>
      </main>
    </div>
  );
}
