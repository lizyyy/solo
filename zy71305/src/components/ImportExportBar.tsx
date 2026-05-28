import React, { useRef, useState } from 'react';
import { Upload, Download, RotateCcw, Save, AlertCircle } from 'lucide-react';
import { useHoistStore } from '../store/useHoistStore';
import { exportToJSON, downloadFile } from '../utils/importExport';

export function ImportExportBar() {
  const {
    points,
    equipment,
    cableSpec,
    params,
    importData,
    loadSavedData,
    resetData,
    calculate,
  } = useHoistStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const handleExport = () => {
    const json = exportToJSON(points, equipment, cableSpec, params);
    downloadFile(json, 'hoist-load-data.json', 'application/json');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const success = importData(content);
      if (!success) {
        setImportError('导入失败：文件格式不正确');
        setTimeout(() => setImportError(null), 3000);
      } else {
        setImportError(null);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleLoadSaved = () => {
    const success = loadSavedData();
    if (!success) {
      setImportError('没有找到已保存的数据');
      setTimeout(() => setImportError(null), 3000);
    }
  };

  return (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-white">舞台吊点载荷校核</h2>
          <span className="text-xs text-slate-500 bg-slate-700 px-2 py-1 rounded">
            v1.0
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors"
          >
            <Upload className="w-4 h-4" />
            导入
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="hidden"
          />

          <button
            onClick={handleLoadSaved}
            className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors"
          >
            <Save className="w-4 h-4" />
            读取上次
          </button>

          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors"
          >
            <Download className="w-4 h-4" />
            导出数据
          </button>

          <button
            onClick={resetData}
            className="flex items-center gap-2 px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-sm transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            重置
          </button>

          <div className="w-px h-6 bg-slate-600 mx-1" />

          <button
            onClick={calculate}
            disabled={points.length === 0}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition-colors shadow-lg shadow-blue-600/25"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
            开始计算
          </button>
        </div>
      </div>

      {importError && (
        <div className="mt-3 flex items-center gap-2 text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded">
          <AlertCircle className="w-4 h-4" />
          {importError}
        </div>
      )}
    </div>
  );
}
