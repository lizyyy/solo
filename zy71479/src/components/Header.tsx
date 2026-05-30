import { Download, FileJson, FileSpreadsheet, Flag } from 'lucide-react';
import { useState } from 'react';
import type { CornerData } from '../types';
import { exportToExcel, exportToJSON } from '../utils/export';

interface HeaderProps {
  corners: CornerData[];
}

const Header = ({ corners }: HeaderProps) => {
  const [showExportMenu, setShowExportMenu] = useState(false);

  return (
    <header className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-orange-500 rounded-lg flex items-center justify-center">
            <Flag className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-wide">卡丁车弯道抓地分析</h1>
            <p className="text-sm text-slate-400">练习数据 · 2024-05-15 · 第3节</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 text-white rounded-lg hover:from-teal-500 hover:to-emerald-500 transition-all duration-200 shadow-lg shadow-teal-900/30"
            >
              <Download className="w-4 h-4" />
              <span className="text-sm font-medium">导出报告</span>
            </button>

            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden">
                <button
                  onClick={() => {
                    exportToExcel(corners);
                    setShowExportMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4 text-green-400" />
                  <span className="text-sm">导出 Excel</span>
                </button>
                <button
                  onClick={() => {
                    exportToJSON(corners);
                    setShowExportMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  <FileJson className="w-4 h-4 text-blue-400" />
                  <span className="text-sm">导出 JSON</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-6 mt-4">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
          <span className="text-xs text-slate-400">抓地匹配良好</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-amber-500"></span>
          <span className="text-xs text-slate-400">接近阈值</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500"></span>
          <span className="text-xs text-slate-400">超出阈值</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-slate-500"></span>
          <span className="text-xs text-slate-400">数据待补充</span>
        </div>
      </div>
    </header>
  );
};

export default Header;
