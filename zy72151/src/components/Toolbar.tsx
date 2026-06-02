import { useState } from 'react';
import { Download, Upload, RotateCcw, FileText, Download as DownloadIcon } from 'lucide-react';
import { useStore, useBusStopStats } from '@/store/useStore';
import { statusLabels, sourceLabels } from '@/types';

export default function Toolbar() {
  const { exportData, importData, resetWithSampleData, busStops, dataSources } = useStore();
  const stats = useBusStopStats();
  const [showReport, setShowReport] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');

  const handleExport = () => {
    const data = exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `公交站点迁移评估_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    if (importText.trim()) {
      importData(importText);
      setImportText('');
      setShowImport(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        importData(text);
      };
      reader.readAsText(file);
    }
  };

  const generateReport = () => {
    const confirmed = busStops.filter((b) => b.status === 'confirmed');
    const pending = busStops.filter((b) => b.status === 'pending');
    const exception = busStops.filter((b) => b.status === 'exception');

    const getSourceTypes = (stopId: string) => {
      return dataSources
        .filter((d) => d.busStopId === stopId)
        .map((d) => sourceLabels[d.type])
        .join(', ');
    };

    return `
公交站点迁移评估报告
==================
生成时间: ${new Date().toLocaleString('zh-CN')}

一、统计概览
----------
总点位数量: ${stats.total}
已确认: ${stats.confirmed}
待处理: ${stats.pending}
例外: ${stats.exception}
已归并: ${stats.merged}
待审核: ${stats.needsReview}
边界记录: ${stats.boundary}

二、已确认点位
------------
${confirmed.map((s, i) => `[${i + 1}] ${s.name || '未命名站点'}
    状态: ${statusLabels[s.status]}
    地址: ${s.address || '无'}
    坐标: ${s.lat.toFixed(4)}, ${s.lng.toFixed(4)}
    来源: ${getSourceTypes(s.id)}
    ${s.notes ? `备注: ${s.notes}` : ''}
`).join('\n')}

三、待处理点位
------------
${pending.map((s, i) => `[${i + 1}] ${s.name || '未命名站点'}
    ${s.needsReview ? '★ 需要人工确认' : ''}
    ${s.isBoundary ? '△ 边界记录' : ''}
    ${s.mergeSuggestions?.length ? `☆ 相似点位: ${s.mergeSuggestions.length}个` : ''}
    来源: ${getSourceTypes(s.id)}
`).join('\n')}

四、例外记录
----------
${exception.length > 0 ? exception.map((s, i) => `[${i + 1}] ${s.name || '未命名站点'}
    地址: ${s.address || '无'}
    ${s.notes ? `备注: ${s.notes}` : ''}
`).join('\n') : '无例外记录'}
`.trim();
  };

  const handleExportReport = () => {
    const report = generateReport();
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `公交站点迁移评估报告_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-3">
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-600">数据管理:</span>
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors"
        >
          <Download className="w-4 h-4" /> 导出数据
        </button>
        <button
          onClick={() => setShowImport(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-600 hover:bg-slate-700 text-white rounded-md transition-colors"
        >
          <Upload className="w-4 h-4" /> 导入数据
        </button>
        <button
          onClick={resetWithSampleData}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-amber-500 hover:bg-amber-600 text-white rounded-md transition-colors"
        >
          <RotateCcw className="w-4 h-4" /> 重置
        </button>
      </div>
      <div className="flex-1" />
      <button
        onClick={() => setShowReport(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-500 hover:bg-emerald-600 text-white rounded-md transition-colors"
      >
        <FileText className="w-4 h-4" /> 生成报告
      </button>

      {showImport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[2000]">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">导入数据</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                选择JSON文件
              </label>
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>
            <div className="my-4 flex items-center gap-2">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-xs text-slate-400">或粘贴JSON</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="粘贴JSON数据..."
              className="w-full h-32 px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowImport(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleImport}
                disabled={!importText.trim()}
                className="px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 text-white rounded-md transition-colors"
              >
                导入
              </button>
            </div>
          </div>
        </div>
      )}

      {showReport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[2000]">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 max-h-[80vh] flex flex-col">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">评估报告预览</h3>
            <pre className="flex-1 overflow-auto p-4 bg-slate-50 rounded-lg text-sm text-slate-700 whitespace-pre-wrap font-mono">
              {generateReport()}
            </pre>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowReport(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
              >
                关闭
              </button>
              <button
                onClick={handleExportReport}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-emerald-500 hover:bg-emerald-600 text-white rounded-md transition-colors"
              >
                <DownloadIcon className="w-4 h-4" /> 导出报告
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
