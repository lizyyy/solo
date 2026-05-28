import { useState } from 'react';
import { Download, FileSpreadsheet, Filter, CheckCircle, FileText, Clock } from 'lucide-react';
import { api, downloadBlob } from '../api/client';
import type { AuditStatus } from '../../shared/types';

export function ExportPage() {
  const [filters, setFilters] = useState({
    status: '' as AuditStatus | '',
    customerId: '',
    productId: '',
    startDate: '',
    endDate: '',
  });
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  const statusOptions: { value: AuditStatus | ''; label: string }[] = [
    { value: '', label: '全部状态' },
    { value: 'pending', label: '待审计' },
    { value: 'normal', label: '审计通过' },
    { value: 'abnormal', label: '存在异常' },
    { value: 'resolved', label: '已处理' },
  ];

  const handleExport = async () => {
    setExporting(true);
    setExportSuccess(false);
    try {
      const exportFilters = { ...filters };
      if (!exportFilters.status) delete exportFilters.status;
      if (!exportFilters.customerId) delete exportFilters.customerId;
      if (!exportFilters.productId) delete exportFilters.productId;
      if (!exportFilters.startDate) delete exportFilters.startDate;
      if (!exportFilters.endDate) delete exportFilters.endDate;

      const blob = await api.exportAudits(exportFilters as Record<string, string>);
      downloadBlob(blob, `审计报告_${new Date().toISOString().split('T')[0]}.xlsx`);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  const resetFilters = () => {
    setFilters({
      status: '',
      customerId: '',
      productId: '',
      startDate: '',
      endDate: '',
    });
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white">审计导出</h1>
        <p className="text-dark-muted mt-1">
          按条件筛选审计记录，导出Excel格式审计报告
        </p>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
          <Filter className="w-5 h-5 text-primary-400" />
          导出条件
        </h2>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm text-dark-muted mb-2">状态筛选</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value as AuditStatus })}
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
            <label className="block text-sm text-dark-muted mb-2">客户ID</label>
            <input
              type="text"
              value={filters.customerId}
              onChange={(e) => setFilters({ ...filters, customerId: e.target.value })}
              placeholder="如：CUST_001"
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm text-dark-muted mb-2">产品ID</label>
            <input
              type="text"
              value={filters.productId}
              onChange={(e) => setFilters({ ...filters, productId: e.target.value })}
              placeholder="如：PROD_X"
              className="input"
            />
          </div>
          <div></div>
          <div>
            <label className="block text-sm text-dark-muted mb-2">开始日期</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm text-dark-muted mb-2">结束日期</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className="input"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={resetFilters} className="btn-secondary">
            重置条件
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="btn-primary flex-1"
          >
            {exporting ? (
              <>
                <Clock className="w-4 h-4 animate-spin" />
                导出中...
              </>
            ) : exportSuccess ? (
              <>
                <CheckCircle className="w-4 h-4" />
                导出成功
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                导出审计报告
              </>
            )}
          </button>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-accent-400" />
          导出内容说明
        </h2>
        <div className="space-y-4">
          <div className="flex items-start gap-4 p-4 bg-dark-surface rounded-lg border border-dark-border">
            <div className="p-2 bg-primary-900/30 rounded-lg">
              <FileText className="w-5 h-5 text-primary-400" />
            </div>
            <div>
              <h3 className="font-medium text-white mb-1">Sheet 1：审计列表</h3>
              <p className="text-sm text-dark-muted">
                包含审计ID、客户名称、产品名称、审计时间、状态、应扣金额、实扣金额、差异金额、主要原因
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4 p-4 bg-dark-surface rounded-lg border border-dark-border">
            <div className="p-2 bg-accent-900/30 rounded-lg">
              <FileText className="w-5 h-5 text-accent-400" />
            </div>
            <div>
              <h3 className="font-medium text-white mb-1">Sheet 2：统计汇总</h3>
              <p className="text-sm text-dark-muted">
                包含总记录数、各状态数量统计、异常涉及总金额
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="card border-primary-500/30 bg-primary-900/10">
        <h3 className="font-semibold text-primary-400 mb-2">💡 使用提示</h3>
        <ul className="space-y-2 text-sm text-dark-text">
          <li className="flex items-start gap-2">
            <span className="text-primary-400">•</span>
            <span>不设置筛选条件将导出全部审计记录</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary-400">•</span>
            <span>单条审计记录的详细报告可在审计详情页导出</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary-400">•</span>
            <span>单条审计报告包含审计摘要、审计链路、费用明细三个工作表</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

export default ExportPage;
