import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  CheckSquare,
  DollarSign,
  Search,
  Filter,
  Download,
  RefreshCw,
  Eye,
  X,
} from 'lucide-react';
import { useAuditStore } from '../store/audit.store';
import { api, downloadBlob } from '../api/client';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/StatusBadge';
import type { AuditStatus } from '../../../shared/types';

export function AuditList() {
  const navigate = useNavigate();
  const { audits, stats, loading, error, filters, fetchStats, fetchAudits, setFilters, clearError } =
    useAuditStore();
  const [showFilters, setShowFilters] = useState(false);
  const [localFilters, setLocalFilters] = useState({
    status: filters.status || '',
    customerId: filters.customerId || '',
    productId: filters.productId || '',
    startDate: filters.startDate || '',
    endDate: filters.endDate || '',
  });

  useEffect(() => {
    fetchStats();
    fetchAudits();
  }, [fetchStats, fetchAudits]);

  const applyFilters = () => {
    setFilters(localFilters as Partial<typeof filters>);
    fetchAudits();
    setShowFilters(false);
  };

  const resetFilters = () => {
    setLocalFilters({ status: '', customerId: '', productId: '', startDate: '', endDate: '' });
    setFilters({});
    fetchAudits();
  };

  const handleExport = async () => {
    try {
      const blob = await api.exportAudits(filters);
      downloadBlob(blob, `审计报告_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const statusOptions: { value: AuditStatus | ''; label: string }[] = [
    { value: '', label: '全部状态' },
    { value: 'pending', label: '待审计' },
    { value: 'normal', label: '审计通过' },
    { value: 'abnormal', label: '存在异常' },
    { value: 'resolved', label: '已处理' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">审计工作台</h1>
          <p className="text-dark-muted mt-1">
            全链路费率审计追踪，每条数据可追溯到底
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-secondary ${showFilters ? 'border-primary-500 text-primary-400' : ''}`}
          >
            <Filter className="w-4 h-4" />
            筛选
          </button>
          <button onClick={handleExport} className="btn-secondary">
            <Download className="w-4 h-4" />
            导出报告
          </button>
          <button
            onClick={() => {
              fetchStats();
              fetchAudits();
            }}
            className="btn-primary"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-900/20 border border-red-700/50 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-3 text-red-400">
            <AlertTriangle className="w-5 h-5" />
            <span>{error}</span>
          </div>
          <button onClick={clearError} className="text-red-400 hover:text-red-300">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {showFilters && (
        <div className="card animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">筛选条件</h3>
            <button onClick={() => setShowFilters(false)} className="text-dark-muted hover:text-dark-text">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm text-dark-muted mb-1">状态</label>
              <select
                value={localFilters.status}
                onChange={(e) => setLocalFilters({ ...localFilters, status: e.target.value as AuditStatus })}
                className="input"
              >
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-dark-muted mb-1">客户ID</label>
              <input
                type="text"
                value={localFilters.customerId}
                onChange={(e) => setLocalFilters({ ...localFilters, customerId: e.target.value })}
                placeholder="如：CUST_001"
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm text-dark-muted mb-1">产品ID</label>
              <input
                type="text"
                value={localFilters.productId}
                onChange={(e) => setLocalFilters({ ...localFilters, productId: e.target.value })}
                placeholder="如：PROD_X"
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm text-dark-muted mb-1">开始日期</label>
              <input
                type="date"
                value={localFilters.startDate}
                onChange={(e) => setLocalFilters({ ...localFilters, startDate: e.target.value })}
                className="input"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={applyFilters} className="btn-primary">
              应用筛选
            </button>
            <button onClick={resetFilters} className="btn-secondary">
              重置
            </button>
          </div>
        </div>
      )}

      <div className="data-grid">
        <StatCard
          title="总记录数"
          value={stats?.total || 0}
          icon={<FileText className="w-6 h-6" />}
          color="blue"
        />
        <StatCard
          title="审计通过"
          value={stats?.normal || 0}
          icon={<CheckCircle className="w-6 h-6" />}
          color="green"
        />
        <StatCard
          title="存在异常"
          value={stats?.abnormal || 0}
          icon={<AlertTriangle className="w-6 h-6" />}
          color="red"
        />
        <StatCard
          title="涉及金额"
          value={`¥${(stats?.totalDiffAmount || 0).toLocaleString()}`}
          icon={<DollarSign className="w-6 h-6" />}
          color="amber"
        />
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">审计记录</h2>
          <div className="flex items-center gap-2 text-sm text-dark-muted">
            <Search className="w-4 h-4" />
            共 {audits.length} 条记录
          </div>
        </div>

        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-border">
                <th className="table-header">客户</th>
                <th className="table-header">产品</th>
                <th className="table-header">应扣金额</th>
                <th className="table-header">实扣金额</th>
                <th className="table-header">差异</th>
                <th className="table-header">状态</th>
                <th className="table-header">审计时间</th>
                <th className="table-header text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border/50">
              {loading && audits.length === 0 ? (
                <tr>
                  <td colSpan={8} className="table-cell text-center py-8 text-dark-muted">
                    加载中...
                  </td>
                </tr>
              ) : audits.length === 0 ? (
                <tr>
                  <td colSpan={8} className="table-cell text-center py-8 text-dark-muted">
                    暂无审计记录
                  </td>
                </tr>
              ) : (
                audits.map((audit, index) => (
                  <tr
                    key={audit.id}
                    className="hover:bg-dark-surface/30 transition-colors animate-slide-up"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <td className="table-cell">
                      <div>
                        <p className="font-medium text-white">{audit.customerName}</p>
                        <p className="text-xs text-dark-muted font-mono">{audit.customerId}</p>
                      </div>
                    </td>
                    <td className="table-cell">
                      <div>
                        <p className="font-medium text-white">{audit.productName}</p>
                        <p className="text-xs text-dark-muted font-mono">{audit.productId}</p>
                      </div>
                    </td>
                    <td className="table-cell font-mono">
                      {formatCurrency(audit.expectedAmount)}
                    </td>
                    <td className="table-cell font-mono">
                      {formatCurrency(audit.actualAmount)}
                    </td>
                    <td className="table-cell">
                      <span
                        className={`font-mono font-medium ${
                          audit.diffAmount > 0
                            ? 'text-red-400'
                            : audit.diffAmount < 0
                              ? 'text-emerald-400'
                              : 'text-dark-muted'
                        }`}
                      >
                        {audit.diffAmount !== 0 ? (audit.diffAmount > 0 ? '+' : '') + formatCurrency(audit.diffAmount) : '-'}
                      </span>
                    </td>
                    <td className="table-cell">
                      <StatusBadge status={audit.status} />
                    </td>
                    <td className="table-cell text-dark-muted text-sm">
                      {new Date(audit.auditTime).toLocaleString('zh-CN')}
                    </td>
                    <td className="table-cell text-right">
                      <button
                        onClick={() => navigate(`/audit/${audit.id}`)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-primary-400 hover:text-primary-300 hover:bg-primary-900/20 rounded-md transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        详情
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default AuditList;
