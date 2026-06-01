import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { StatusBadge } from './StatusBadge';
import { Eye, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { ExportService } from '../services/exportService';
import { FileSpreadsheet, FileText } from 'lucide-react';

export function DataTable() {
  const navigate = useNavigate();
  const { getFilteredRecords, filters } = useStore();
  const records = getFilteredRecords();
  const [currentPage, setCurrentPage] = useState(1);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const pageSize = 10;

  const totalPages = Math.ceil(records.length / pageSize);
  const paginatedRecords = records.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleExportCSV = () => {
    ExportService.exportToCSV(records, filters);
    setShowExportMenu(false);
  };

  const handleExportExcel = () => {
    ExportService.exportToExcel(records, filters);
    setShowExportMenu(false);
  };

  return (
    <div className="card overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-800 font-display">估算记录列表</h3>
        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="btn-secondary text-sm"
          >
            <Download className="w-4 h-4 mr-2" />
            导出
          </button>
          {showExportMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-slate-200 z-10">
              <button
                onClick={handleExportCSV}
                className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                导出 CSV
              </button>
              <button
                onClick={handleExportExcel}
                className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
              >
                <FileSpreadsheet className="w-4 h-4" />
                导出 Excel
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">记录编号</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">区域</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">计算日期</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">状态</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">估算容量</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">异常数</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">备注</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {paginatedRecords.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                  暂无数据
                </td>
              </tr>
            ) : (
              paginatedRecords.map((record, index) => (
                <tr
                  key={record.id}
                  className={`hover:bg-slate-50 transition-colors cursor-pointer ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
                  onClick={() => navigate(`/detail/${record.id}`)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="font-medium text-slate-900">{record.recordNo}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-600">{record.area}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-600">{record.calculationDate}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={record.status} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {record.calculatedResult ? (
                      <span className="font-medium text-primary-700">
                        {record.calculatedResult.capacity.toFixed(2)} {record.calculatedResult.unit}
                      </span>
                    ) : (
                      <span className="text-slate-400">N/A</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {record.anomalies.length > 0 ? (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        record.anomalies.some(a => a.severity === 'high')
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {record.anomalies.length} 项
                      </span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 max-w-xs">
                    <p className="text-sm text-slate-600 truncate" title={record.remark}>
                      {record.remark}
                    </p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/detail/${record.id}`);
                      }}
                      className="inline-flex items-center px-3 py-1.5 text-sm text-primary-600 hover:text-primary-800 hover:bg-primary-50 rounded transition-colors"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      详情
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
          <div className="text-sm text-slate-500">
            显示 {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, records.length)} 条，共 {records.length} 条
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-8 h-8 rounded text-sm ${
                  page === currentPage
                    ? 'bg-primary-600 text-white'
                    : 'border border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
