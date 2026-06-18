import { X, Download, FileText, Link } from 'lucide-react';
import { useState } from 'react';
import { useReportStore } from '@/store/reportStore';
import { exportToCSV, exportToJSON, downloadFile, encodeFilterState } from '@/utils/export';
import type { ExportOptions } from '@/types';

export default function ExportModal() {
  const {
    exportModalOpen,
    toggleExportModal,
    getFilteredRecords,
    getCurrentVersion,
    filter,
  } = useReportStore();

  const [options, setOptions] = useState<ExportOptions>({
    format: 'csv',
    includeAnomaly: true,
    includeRawData: false,
    embedFilter: true,
  });

  const [showShareLink, setShowShareLink] = useState(false);

  if (!exportModalOpen) return null;

  const version = getCurrentVersion();
  const records = getFilteredRecords();

  const handleExport = () => {
    if (!version) return;

    const exportRecords = options.includeAnomaly
      ? records
      : records.filter((r) => r.isNormal);

    let content: string;
    let filename: string;
    let mimeType: string;

    if (options.format === 'csv') {
      content = exportToCSV(exportRecords, version, options, filter);
      filename = `港湾淤积报告_${version.name}_${new Date().toISOString().slice(0, 10)}.csv`;
      mimeType = 'text/csv;charset=utf-8';
    } else {
      content = exportToJSON(exportRecords, version, options, filter);
      filename = `港湾淤积报告_${version.name}_${new Date().toISOString().slice(0, 10)}.json`;
      mimeType = 'application/json';
    }

    downloadFile(content, filename, mimeType);
  };

  const generateShareLink = () => {
    const filterCode = encodeFilterState(filter);
    const url = `${window.location.origin}${window.location.pathname}?filter=${filterCode}&version=${version?.id || 'v3'}`;
    navigator.clipboard.writeText(url);
    setShowShareLink(true);
    setTimeout(() => setShowShareLink(false), 3000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <Download size={18} className="text-ocean-600" />
            导出报告
          </h3>
          <button
            onClick={toggleExportModal}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">导出格式</label>
            <div className="flex gap-2">
              <button
                onClick={() => setOptions({ ...options, format: 'csv' })}
                className={`flex-1 py-2 px-3 text-sm rounded border transition-colors flex items-center justify-center gap-2 ${
                  options.format === 'csv'
                    ? 'bg-ocean-100 text-ocean-700 border-ocean-300'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <FileText size={14} />
                CSV
              </button>
              <button
                onClick={() => setOptions({ ...options, format: 'json' })}
                className={`flex-1 py-2 px-3 text-sm rounded border transition-colors flex items-center justify-center gap-2 ${
                  options.format === 'json'
                    ? 'bg-ocean-100 text-ocean-700 border-ocean-300'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <FileText size={14} />
                JSON
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={options.includeAnomaly}
                onChange={(e) => setOptions({ ...options, includeAnomaly: e.target.checked })}
                className="w-4 h-4 text-ocean-600 rounded"
              />
              <span className="text-sm text-gray-700">包含异常数据</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={options.includeRawData}
                onChange={(e) => setOptions({ ...options, includeRawData: e.target.checked })}
                className="w-4 h-4 text-ocean-600 rounded"
              />
              <span className="text-sm text-gray-700">包含原始经纬度数据</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={options.embedFilter}
                onChange={(e) => setOptions({ ...options, embedFilter: e.target.checked })}
                className="w-4 h-4 text-ocean-600 rounded"
              />
              <span className="text-sm text-gray-700">嵌入筛选条件（复核人可追溯）</span>
            </label>
          </div>

          <div className="bg-gray-50 rounded p-3 text-sm text-gray-600">
            <p>当前版本：<span className="font-medium">{version?.name}</span></p>
            <p>筛选后记录：<span className="font-medium">{records.length}条</span></p>
            {options.includeAnomaly ? (
              <p className="text-warning-600">包含异常数据：{records.filter((r) => !r.isNormal).length}条</p>
            ) : (
              <p className="text-green-600">仅正常记录</p>
            )}
          </div>

          <div className="border-t border-gray-200 pt-4">
            <button
              onClick={generateShareLink}
              className="w-full py-2 px-4 border border-gray-300 text-gray-700 text-sm rounded hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 mb-2"
            >
              <Link size={16} />
              {showShareLink ? '已复制筛选链接' : '复制筛选链接（复核人用）'}
            </button>
          </div>
        </div>

        <div className="flex gap-2 p-4 border-t border-gray-200">
          <button
            onClick={toggleExportModal}
            className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 text-sm rounded hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleExport}
            className="flex-1 py-2 px-4 bg-ocean-600 text-white text-sm rounded hover:bg-ocean-700 transition-colors flex items-center justify-center gap-2"
          >
            <Download size={16} />
            导出
          </button>
        </div>
      </div>
    </div>
  );
}
