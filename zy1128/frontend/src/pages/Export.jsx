import React, { useState } from 'react';
import { useQuery } from 'react-query';
import {
  getReconciliations,
  getHolders,
  getProducts,
  getAccounts,
  exportReconciliations,
  exportHolderAllocations
} from '../services/api';
import { formatCurrency, formatDate, getStatusLabel } from '../utils/format';

function Export() {
  const [exportType, setExportType] = useState('reconciliations');
  const [selectedHolder, setSelectedHolder] = useState('');
  const [filters, setFilters] = useState({
    start_date: '',
    end_date: '',
    difference_type: ''
  });

  const { data: holders } = useQuery('holders', () => getHolders());
  const { data: products } = useQuery('products', () => getProducts());
  const { data: accounts } = useQuery('accounts', () => getAccounts());

  const handleExport = (format) => {
    let url;
    if (exportType === 'reconciliations') {
      url = exportReconciliations(format, filters);
    } else if (exportType === 'holder-allocations' && selectedHolder) {
      url = exportHolderAllocations(selectedHolder, format, filters);
    } else {
      return;
    }
    window.open(url, '_blank');
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const differenceTypeOptions = [
    { value: '', label: '全部状态' },
    { value: 'matched', label: '已匹配' },
    { value: 'unmatched', label: '未到账' },
    { value: 'underpaid', label: '少到账' },
    { value: 'overpaid', label: '多到账' },
    { value: 'manual', label: '手工调整' },
  ];

  const exportTypes = [
    { id: 'reconciliations', label: '核对报告', icon: '📋', description: '导出所有核对记录的汇总报告' },
    { id: 'holder-allocations', label: '持有人分摊明细', icon: '👥', description: '导出指定持有人的份额分摊明细' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">导出报告</h1>
        <p className="text-gray-500 mt-1">导出核对报告和持有人分摊明细</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {exportTypes.map((type) => (
          <div
            key={type.id}
            onClick={() => {
              setExportType(type.id);
            }}
            className={`card p-6 cursor-pointer transition-all ${
              exportType === type.id
                ? 'border-primary-500 ring-2 ring-primary-200'
                : 'hover:border-gray-300'
            }`}
          >
            <div className="flex items-start gap-4">
              <span className="text-3xl">{type.icon}</span>
              <div>
                <h3 className="font-semibold text-gray-900">{type.label}</h3>
                <p className="text-sm text-gray-500 mt-1">{type.description}</p>
              </div>
              {exportType === type.id && (
                <span className="ml-auto text-primary-600">✓</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">筛选条件</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {exportType === 'holder-allocations' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">持有人</label>
              <select
                value={selectedHolder}
                onChange={(e) => setSelectedHolder(e.target.value)}
                className="select"
              >
                <option value="">请选择持有人</option>
                {holders?.data?.map(holder => (
                  <option key={holder.id} value={holder.id}>{holder.holder_name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
            <select
              value={filters.difference_type}
              onChange={(e) => handleFilterChange('difference_type', e.target.value)}
              className="select"
            >
              {differenceTypeOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">开始日期</label>
            <input
              type="date"
              value={filters.start_date}
              onChange={(e) => handleFilterChange('start_date', e.target.value)}
              className="input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">结束日期</label>
            <input
              type="date"
              value={filters.end_date}
              onChange={(e) => handleFilterChange('end_date', e.target.value)}
              className="input"
            />
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">导出格式</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <button
            onClick={() => handleExport('csv')}
            disabled={exportType === 'holder-allocations' && !selectedHolder}
            className="card p-4 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">📊</span>
              <div>
                <h3 className="font-semibold text-gray-900">CSV</h3>
                <p className="text-sm text-gray-500">逗号分隔值文件，可直接用 Excel 打开</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => handleExport('html')}
            disabled={exportType === 'holder-allocations' && !selectedHolder}
            className="card p-4 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🌐</span>
              <div>
                <h3 className="font-semibold text-gray-900">HTML</h3>
                <p className="text-sm text-gray-500">网页格式，可在浏览器中查看打印</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => handleExport('markdown')}
            disabled={exportType === 'holder-allocations' && !selectedHolder}
            className="card p-4 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">📝</span>
              <div>
                <h3 className="font-semibold text-gray-900">Markdown</h3>
                <p className="text-sm text-gray-500">Markdown 格式，可复制到文档编辑器</p>
              </div>
            </div>
          </button>
        </div>

        {exportType === 'holder-allocations' && !selectedHolder && (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              ⚠️ 请先选择持有人再导出分摊明细
            </p>
          </div>
        )}
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">导出内容预览</h2>
        
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="font-medium text-gray-700 mb-2">核对报告包含内容：</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• 统计摘要（已匹配、未到账、少到账、多到账数量）</li>
            <li>• 汇总表格（到账日期、产品、持有人、账户、应到账、实际到账、差额、状态）</li>
            <li>• 异常详情（未到账、少到账、多到账记录的详细说明）</li>
          </ul>
          
          <h3 className="font-medium text-gray-700 mt-4 mb-2">持有人分摊明细包含内容：</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• 持有人信息和总分摊汇总</li>
            <li>• 各产品分摊明细（产品名称、份额比例、分摊本金、分摊利息、分摊管理费、分摊赎回费、分摊差额）</li>
            <li>• 汇总统计（总本金、总利息、总费用、总差额）</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default Export;
