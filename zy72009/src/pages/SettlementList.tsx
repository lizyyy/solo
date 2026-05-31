import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  Download,
  Search,
  Calendar,
  Eye,
  CheckCircle2,
  Clock,
  Edit3,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { useSettlementStore } from '../store/useSettlementStore';
import StatusBadge from '../components/StatusBadge';
import SourceBadge from '../components/SourceBadge';
import ImportModal from '../components/ImportModal';
import { formatCurrency } from '../utils/amount';
import { formatDateTime } from '../utils/date';
import type { SettlementStatus } from '../types';
import { STATUS_LABELS } from '../types';

export default function SettlementList() {
  const navigate = useNavigate();
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [exportStatus, setExportStatus] = useState<SettlementStatus | 'all'>('all');
  const [showExportMenu, setShowExportMenu] = useState(false);

  const {
    init,
    getFilteredSettlements,
    filters,
    setFilters,
    getStats,
    exportData,
    loading,
    initialized,
  } = useSettlementStore();

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (showExportMenu) {
      const timer = setTimeout(() => setShowExportMenu(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showExportMenu]);

  if (!initialized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  const settlements = getFilteredSettlements();
  const stats = getStats();

  const handleExport = (status: SettlementStatus | 'all') => {
    exportData(status);
    setShowExportMenu(false);
  };

  const statCards = [
    {
      label: '已确认',
      value: stats.confirmed,
      color: 'success',
      icon: CheckCircle2,
      bg: 'bg-gradient-to-br from-success-50 to-success-100',
      border: 'border-success-200',
      text: 'text-success-700',
      valueColor: 'text-success-600',
    },
    {
      label: '待补材料',
      value: stats.needMaterial,
      color: 'warning',
      icon: Clock,
      bg: 'bg-gradient-to-br from-warning-50 to-warning-100',
      border: 'border-warning-200',
      text: 'text-warning-700',
      valueColor: 'text-warning-600',
    },
    {
      label: '人工改判',
      value: stats.manualAdjust,
      color: 'adjust',
      icon: Edit3,
      bg: 'bg-gradient-to-br from-adjust-50 to-adjust-100',
      border: 'border-adjust-200',
      text: 'text-adjust-700',
      valueColor: 'text-adjust-600',
    },
    {
      label: '待审核',
      value: stats.pending + stats.conflict,
      color: 'neutral',
      icon: AlertTriangle,
      bg: 'bg-gradient-to-br from-neutral-50 to-neutral-100',
      border: 'border-neutral-200',
      text: 'text-neutral-700',
      valueColor: 'text-neutral-600',
    },
  ];

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-serif font-semibold text-neutral-900">
                社区团购佣金清分
              </h1>
              <p className="text-sm text-neutral-500 mt-0.5">
                风控复核工作台 - 操作员：林姐（风控复核员）
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <button
                  className="btn flex items-center gap-2"
                  onClick={() => setShowExportMenu(!showExportMenu)}
                >
                  <Download size={16} />
                  导出
                </button>
                {showExportMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white border border-neutral-200 shadow-lg z-10">
                    <button
                      className="w-full px-4 py-2 text-sm text-left hover:bg-neutral-50 border-b border-neutral-100"
                      onClick={() => handleExport('all')}
                    >
                      导出全部（分Sheet）
                    </button>
                    <button
                      className="w-full px-4 py-2 text-sm text-left hover:bg-neutral-50 border-b border-neutral-100"
                      onClick={() => handleExport('confirmed')}
                    >
                      仅导出已确认
                    </button>
                    <button
                      className="w-full px-4 py-2 text-sm text-left hover:bg-neutral-50 border-b border-neutral-100"
                      onClick={() => handleExport('need_material')}
                    >
                      仅导出待补材料
                    </button>
                    <button
                      className="w-full px-4 py-2 text-sm text-left hover:bg-neutral-50"
                      onClick={() => handleExport('manual_adjust')}
                    >
                      仅导出人工改判
                    </button>
                  </div>
                )}
              </div>
              <button
                className="btn btn-primary flex items-center gap-2"
                onClick={() => setImportModalOpen(true)}
                disabled={loading}
              >
                <Upload size={16} />
                导入数据
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-4 gap-4 mb-6">
          {statCards.map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <div
                key={idx}
                className={`card p-5 ${stat.bg} ${stat.border}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className={`text-sm ${stat.text}`}>{stat.label}</p>
                    <p className={`text-3xl font-bold mt-1 font-mono ${stat.valueColor}`}>
                      {stat.value}
                    </p>
                  </div>
                  <div className={`p-2 rounded-lg bg-white/60 ${stat.text}`}>
                    <Icon size={20} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="card mb-6">
          <div className="p-4 border-b border-neutral-200">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-sm text-neutral-600 whitespace-nowrap">状态：</label>
                <select
                  value={filters.status}
                  onChange={e => setFilters({ status: e.target.value as any })}
                  className="select w-40"
                >
                  <option value="all">全部</option>
                  {(Object.keys(STATUS_LABELS) as SettlementStatus[]).map(status => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 flex-1 min-w-[300px]">
                <label className="text-sm text-neutral-600 whitespace-nowrap">搜索：</label>
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <input
                    type="text"
                    value={filters.keyword}
                    onChange={e => setFilters({ keyword: e.target.value })}
                    placeholder="输入批次号或商户名称"
                    className="input pl-10"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-neutral-500" />
                <input
                  type="date"
                  className="input w-36"
                  placeholder="开始日期"
                />
                <span className="text-neutral-400">至</span>
                <input
                  type="date"
                  className="input w-36"
                  placeholder="结束日期"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3">批次号</th>
                  <th className="px-4 py-3">商户名称</th>
                  <th className="px-4 py-3 text-right">清分金额</th>
                  <th className="px-4 py-3">状态</th>
                  <th className="px-4 py-3">来源</th>
                  <th className="px-4 py-3">处理时间</th>
                  <th className="px-4 py-3">操作人</th>
                  <th className="px-4 py-3 text-right sticky right-0 bg-neutral-50">操作</th>
                </tr>
              </thead>
              <tbody>
                {settlements.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-neutral-500">
                      暂无数据
                    </td>
                  </tr>
                ) : (
                  settlements.map((s, idx) => (
                    <tr key={s.id} className={idx % 2 === 0 ? 'table-row' : 'table-row-alt'}>
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm text-primary-700">{s.id}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-900">
                        {s.merchantName}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-neutral-900">
                        {formatCurrency(s.amount)}
                        {s.originalAmount && (
                          <div className="text-xs text-neutral-500 line-through">
                            {formatCurrency(s.originalAmount)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge
                          status={s.status}
                          pulse={s.status === 'pending' || s.status === 'conflict'}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <SourceBadge source={s.source} />
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-500">
                        {formatDateTime(s.updatedAt)}
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-600">
                        {s.operator || '-'}
                      </td>
                      <td className="px-4 py-3 text-right sticky right-0 bg-inherit">
                        <button
                          className="btn btn-ghost text-primary-600 flex items-center gap-1 ml-auto"
                          onClick={() => navigate(`/detail/${s.id}`)}
                        >
                          <Eye size={14} />
                          详情
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-3 border-t border-neutral-200 text-sm text-neutral-500 flex items-center justify-between">
            <span>共 {settlements.length} 条记录</span>
            <span>
              数据更新时间：{formatDateTime(new Date().toISOString())}
            </span>
          </div>
        </div>
      </main>

      <ImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
      />
    </div>
  );
}
