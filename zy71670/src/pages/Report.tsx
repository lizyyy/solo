import React, { useState } from 'react';
import { useStore } from '../store';
import { exportToPDF, exportToExcel } from '../utils/export';
import { formatDate } from '../utils/tension';
import { ErrorType, ERROR_TYPE_LABELS, RISK_LEVEL_LABELS } from '../types';
import { FileDown, Filter, ArrowLeft, FileText, Table } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const Report: React.FC = () => {
  const navigate = useNavigate();
  const { records, customers, instruments, filters, setFilters } = useStore();
  
  const [showTaggedOnly, setShowTaggedOnly] = useState(filters.showTagged);
  const [selectedErrorType, setSelectedErrorType] = useState<ErrorType | ''>(filters.errorType || '');

  const filteredRecords = records.filter((r) => {
    if (showTaggedOnly && r.errorTags.length === 0) return false;
    if (showTaggedOnly && r.errorTags.every((t) => t.resolved)) return false;
    if (selectedErrorType && !r.errorTags.some((t) => t.type === selectedErrorType)) return false;
    return true;
  });

  const handleExportPDF = () => {
    exportToPDF(filteredRecords, customers, instruments);
  };

  const handleExportExcel = () => {
    exportToExcel(filteredRecords, customers, instruments);
  };

  const getInstrument = (instrumentId: string) => {
    return instruments.find((i) => i.id === instrumentId);
  };

  const getCustomer = (customerId: string) => {
    return customers.find((c) => c.id === customerId);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-primary-800 text-white px-6 py-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 rounded-lg hover:bg-primary-700 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="font-serif text-xl font-semibold">报告预览与导出</h1>
              <p className="text-xs text-primary-200">筛选并导出琴弦张力预警报告</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportExcel}
              className="btn-secondary flex items-center gap-2"
            >
              <Table size={16} />
              导出 Excel
            </button>
            <button
              onClick={handleExportPDF}
              className="btn-primary flex items-center gap-2"
            >
              <FileDown size={16} />
              导出 PDF
            </button>
          </div>
        </div>
      </header>

      {/* Filters */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-gray-500" />
            <span className="text-sm font-medium text-gray-700">筛选条件</span>
          </div>
          
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showTaggedOnly}
              onChange={(e) => {
                setShowTaggedOnly(e.target.checked);
                setFilters({ showTagged: e.target.checked });
              }}
              className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
            />
            <span className="text-sm text-gray-600">仅显示有未解决标记的记录</span>
          </label>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">错误类型：</span>
            <select
              value={selectedErrorType}
              onChange={(e) => {
                const val = e.target.value as ErrorType | '';
                setSelectedErrorType(val);
                setFilters({ errorType: val || undefined });
              }}
              className="input-base w-40 py-1"
            >
              <option value="">全部</option>
              {Object.entries(ERROR_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div className="text-sm text-gray-500 ml-auto">
            共 {filteredRecords.length} 条记录
          </div>
        </div>
      </div>

      {/* Report Content */}
      <div className="p-6">
        <div className="max-w-5xl mx-auto">
          {/* Report Summary */}
          <div className="card-base mb-6">
            <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <FileText size={20} />
              报告摘要
            </h2>
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-3xl font-bold text-gray-800">{filteredRecords.length}</p>
                <p className="text-sm text-gray-500">总记录数</p>
              </div>
              <div className="text-center p-4 bg-danger-50 rounded-lg">
                <p className="text-3xl font-bold text-danger-600">
                  {filteredRecords.filter((r) => r.final.riskLevel >= 4).length}
                </p>
                <p className="text-sm text-gray-500">高风险记录</p>
              </div>
              <div className="text-center p-4 bg-warning-50 rounded-lg">
                <p className="text-3xl font-bold text-warning-600">
                  {filteredRecords.filter((r) => r.errorTags.some((t) => !t.resolved)).length}
                </p>
                <p className="text-sm text-gray-500">待解决标记</p>
              </div>
              <div className="text-center p-4 bg-success-50 rounded-lg">
                <p className="text-3xl font-bold text-success-600">
                  {filteredRecords.filter((r) => r.final.riskLevel <= 2).length}
                </p>
                <p className="text-sm text-gray-500">低风险记录</p>
              </div>
            </div>
          </div>

          {/* Records Table */}
          <div className="card-base">
            <h2 className="font-semibold text-gray-800 mb-4">记录明细</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-3 font-medium text-gray-600">时间</th>
                    <th className="text-left py-3 px-3 font-medium text-gray-600">客户</th>
                    <th className="text-left py-3 px-3 font-medium text-gray-600">乐器</th>
                    <th className="text-left py-3 px-3 font-medium text-gray-600">弦号</th>
                    <th className="text-left py-3 px-3 font-medium text-gray-600">规格</th>
                    <th className="text-left py-3 px-3 font-medium text-gray-600">音高</th>
                    <th className="text-left py-3 px-3 font-medium text-gray-600">张力(N)</th>
                    <th className="text-left py-3 px-3 font-medium text-gray-600">风险等级</th>
                    <th className="text-left py-3 px-3 font-medium text-gray-600">标记</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((record) => {
                    const instrument = getInstrument(record.instrumentId);
                    const customer = instrument ? getCustomer(instrument.customerId) : null;
                    const unresolvedTags = record.errorTags.filter((t) => !t.resolved);
                    
                    return (
                      <tr
                        key={record.id}
                        className={`border-b border-gray-100 hover:bg-gray-50 ${
                          unresolvedTags.length > 0 ? 'bg-warning-50' : ''
                        }`}
                      >
                        <td className="py-3 px-3 text-gray-600">
                          {formatDate(record.createdAt)}
                        </td>
                        <td className="py-3 px-3 font-medium text-gray-800">
                          {customer?.name || '-'}
                        </td>
                        <td className="py-3 px-3 text-gray-600">
                          {instrument ? `${instrument.brand} ${instrument.model}` : '-'}
                        </td>
                        <td className="py-3 px-3 text-gray-600">第{record.stringNumber}弦</td>
                        <td className="py-3 px-3 font-mono text-gray-600">{record.stringSpec}</td>
                        <td className="py-3 px-3 font-mono text-gray-600">{record.pitch}</td>
                        <td className="py-3 px-3 font-mono font-medium text-gray-800">
                          {record.final.tension.toFixed(1)}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`badge ${
                            record.final.riskLevel >= 4 ? 'badge-danger' :
                            record.final.riskLevel >= 3 ? 'badge-warning' : 'badge-success'
                          }`}>
                            {RISK_LEVEL_LABELS[record.final.riskLevel]}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          {unresolvedTags.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {unresolvedTags.slice(0, 2).map((tag) => (
                                <span
                                  key={tag.id}
                                  className="badge badge-danger text-xs"
                                  title={tag.description}
                                >
                                  {ERROR_TYPE_LABELS[tag.type]}
                                </span>
                              ))}
                              {unresolvedTags.length > 2 && (
                                <span className="badge badge-info text-xs">
                                  +{unresolvedTags.length - 2}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              
              {filteredRecords.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  暂无符合条件的记录
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
