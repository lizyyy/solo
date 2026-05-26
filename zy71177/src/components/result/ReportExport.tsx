import React from 'react';
import { FileText, FileJson, RotateCcw, Home, Play } from 'lucide-react';
import { GameRecord, ScoreBreakdown } from '../../types';
import { exportReportAsText, exportReportAsJSON } from '../../utils/export';

interface ReportExportProps {
  record: GameRecord;
  scoreBreakdown: ScoreBreakdown;
  onRestart: () => void;
  onBackToMenu: () => void;
  onReplay: () => void;
}

export const ReportExport: React.FC<ReportExportProps> = ({
  record,
  scoreBreakdown,
  onRestart,
  onBackToMenu,
  onReplay
}) => {
  return (
    <div className="bg-slate-800/50 rounded-xl p-6 backdrop-blur-sm border border-slate-700">
      <h3 className="text-lg font-semibold text-white mb-4">操作与报告</h3>

      <div className="space-y-3 mb-6">
        <button
          onClick={() => exportReportAsText(record, scoreBreakdown)}
          className="w-full flex items-center justify-center gap-2 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all group"
        >
          <FileText size={18} className="text-blue-400 group-hover:text-blue-300" />
          <span>导出文本报告 (.txt)</span>
        </button>

        <button
          onClick={() => exportReportAsJSON(record, scoreBreakdown)}
          className="w-full flex items-center justify-center gap-2 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all group"
        >
          <FileJson size={18} className="text-green-400 group-hover:text-green-300" />
          <span>导出数据文件 (.json)</span>
        </button>

        <button
          onClick={onReplay}
          className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-purple-500/20 to-pink-500/20 hover:from-purple-500/30 hover:to-pink-500/30 border border-purple-500/30 text-purple-400 hover:text-purple-300 rounded-lg transition-all"
        >
          <Play size={18} />
          <span>查看历史回放</span>
        </button>
      </div>

      <div className="border-t border-slate-700 pt-4">
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onRestart}
            className="flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-semibold rounded-lg transition-all shadow-lg shadow-blue-500/30"
          >
            <RotateCcw size={18} />
            再来一次
          </button>

          <button
            onClick={onBackToMenu}
            className="flex items-center justify-center gap-2 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all"
          >
            <Home size={18} />
            返回菜单
          </button>
        </div>
      </div>

      <div className="mt-4 p-3 bg-slate-900/50 rounded-lg">
        <div className="text-xs text-slate-500 mb-1">游戏编号</div>
        <div className="font-mono text-sm text-slate-400">{record.id}</div>
      </div>
    </div>
  );
};
