import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WarningStatus, STATUS_LABELS, WARNING_TYPE_LABELS, MATERIAL_TYPE_LABELS } from '../types';
import { useWarningStore } from '../hooks/useWarningStore';
import { downloadCSV, downloadJSON } from '../utils/exportUtils';
import ImportModal from './ImportModal';

const WarningList: React.FC = () => {
  const navigate = useNavigate();
  const { filterRecords, resetToMockData } = useWarningStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<WarningStatus | ''>('');
  const [showImportModal, setShowImportModal] = useState(false);

  const filteredRecords = filterRecords({
    status: statusFilter || undefined,
    search: searchTerm || undefined,
  });

  const handleExportCSV = () => {
    downloadCSV(filteredRecords);
  };

  const handleExportJSON = () => {
    downloadJSON(filteredRecords);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-primary-500 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-xl font-bold">供应商票据池预警系统</h1>
          <p className="text-sm text-primary-100 mt-1">风控复核工作台</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <input
                type="text"
                placeholder="搜索供应商名称或备注..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent w-64"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as WarningStatus | '')}
                className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">全部状态</option>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowImportModal(true)}
                className="px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors"
              >
                导入数据
              </button>
              <button
                onClick={handleExportCSV}
                className="px-4 py-2 bg-success text-white rounded-md hover:bg-green-700 transition-colors"
              >
                导出CSV
              </button>
              <button
                onClick={handleExportJSON}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
              >
                导出JSON
              </button>
              <button
                onClick={resetToMockData}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
              >
                重置样例
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">供应商名称</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">票据金额</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">预警类型</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">状态</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">数据来源</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">更新时间</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredRecords.map((record) => (
                  <tr key={record.id} className="table-row">
                    <td className="px-4 py-3 text-sm text-gray-900">{record.supplierName}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 font-mono">¥{record.billAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{WARNING_TYPE_LABELS[record.warningType]}</td>
                    <td className="px-4 py-3">
                      <span className={`status-badge status-${record.status}`}>
                        {STATUS_LABELS[record.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{MATERIAL_TYPE_LABELS[record.source]}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{record.updatedAt}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/detail/${record.id}`)}
                        className="text-primary-500 hover:text-primary-700 text-sm font-medium"
                      >
                        查看详情
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredRecords.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              暂无匹配的预警记录
            </div>
          )}
        </div>

        <div className="mt-4 text-sm text-gray-500">
          共 {filteredRecords.length} 条记录
        </div>
      </main>

      {showImportModal && (
        <ImportModal onClose={() => setShowImportModal(false)} />
      )}
    </div>
  );
};

export default WarningList;
