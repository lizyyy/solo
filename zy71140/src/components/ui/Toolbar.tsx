import { useState } from 'react';
import {
  Search,
  Upload,
  Download,
  RotateCcw,
  FileJson,
  FileSpreadsheet,
  ChevronDown,
} from 'lucide-react';
import { useStore } from '../../store/useStore';

export function Toolbar() {
  const { searchQuery, setSearchQuery, loadSampleData, resetState, exportReportJSON, exportReportCSV } =
    useStore();
  const [showExportMenu, setShowExportMenu] = useState(false);

  return (
    <div className="absolute top-0 left-0 right-0 z-20 bg-slate-900/90 backdrop-blur-md border-b border-slate-700/50">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">❄</span>
            </div>
            <div>
              <h1 className="text-white font-semibold text-sm">冷库货位温层可视化</h1>
              <p className="text-slate-400 text-xs">Cold Storage Visualization</p>
            </div>
          </div>
        </div>

        <div className="flex-1 max-w-md mx-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="搜索货位、SKU名称、批次号..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-800/80 border border-slate-600/50 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadSampleData}
            className="flex items-center gap-2 px-3 py-2 bg-slate-700/50 hover:bg-slate-600/50 border border-slate-600/50 rounded-lg text-white text-sm transition-all"
          >
            <Upload className="w-4 h-4" />
            <span>导入样例</span>
          </button>

          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-2 px-3 py-2 bg-cyan-600/80 hover:bg-cyan-500/80 rounded-lg text-white text-sm transition-all"
            >
              <Download className="w-4 h-4" />
              <span>导出报告</span>
              <ChevronDown className="w-4 h-4" />
            </button>

            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-600 rounded-lg shadow-xl overflow-hidden">
                <button
                  onClick={() => {
                    exportReportJSON();
                    setShowExportMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-700 text-white text-sm transition-colors"
                >
                  <FileJson className="w-4 h-4 text-cyan-400" />
                  导出 JSON 格式
                </button>
                <button
                  onClick={() => {
                    exportReportCSV();
                    setShowExportMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-700 text-white text-sm transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4 text-green-400" />
                  导出 CSV 格式
                </button>
              </div>
            )}
          </div>

          <button
            onClick={resetState}
            className="flex items-center gap-2 px-3 py-2 bg-slate-700/50 hover:bg-red-600/50 border border-slate-600/50 hover:border-red-500/50 rounded-lg text-white text-sm transition-all"
          >
            <RotateCcw className="w-4 h-4" />
            <span>重置</span>
          </button>
        </div>
      </div>
    </div>
  );
}
