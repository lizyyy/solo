import { useGameStore } from '../store/gameStore';
import { ReportCard } from '../components/ReportCard';
import { functionCards } from '../data/functionCards';
import { FileBarChart, Plus, FileText, Download } from 'lucide-react';
import { generateBatchReport, exportBatchReport } from '../utils/reportGenerator';

export const Reports = () => {
  const {
    reports,
    records,
    exceptions,
    currentBatchId,
    score,
    maxCombo,
    generateReport,
    addReport,
  } = useGameStore();

  const handleGenerateCurrentBatchReport = () => {
    const report = generateBatchReport(
      currentBatchId,
      records,
      exceptions,
      functionCards,
      score,
      maxCombo
    );
    addReport(report);
  };

  const handleExportAllJson = async () => {
    reports.forEach(async (report) => {
      await exportBatchReport(report, functionCards, 'json');
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2 font-orbitron">
              批次报告
            </h1>
            <p className="text-slate-400">
              查看和导出游戏批次报告，文件名包含批次号便于区分
            </p>
          </div>
          <div className="flex items-center gap-3">
            {reports.length > 0 && (
              <button
                onClick={handleExportAllJson}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
              >
                <Download className="w-4 h-4" />
                导出全部 JSON
              </button>
            )}
            <button
              onClick={handleGenerateCurrentBatchReport}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-600 to-purple-600 text-white rounded-lg font-bold hover:from-cyan-500 hover:to-purple-500 transition-all shadow-lg shadow-cyan-500/30"
            >
              <Plus className="w-5 h-5" />
              生成当前批次报告
            </button>
          </div>
        </div>

        {reports.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-24 h-24 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <FileBarChart className="w-12 h-12 text-slate-600" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3 font-orbitron">
              暂无报告
            </h2>
            <p className="text-slate-400 mb-8 max-w-md mx-auto">
              点击上方按钮生成当前批次的游戏报告。报告将包含完整的游戏记录、异常分析和统计数据。
            </p>
            <button
              onClick={handleGenerateCurrentBatchReport}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-600 to-purple-600 text-white rounded-lg font-bold hover:from-cyan-500 hover:to-purple-500 transition-all shadow-lg shadow-cyan-500/30 mx-auto"
            >
              <FileText className="w-5 h-5" />
              生成第一份报告
            </button>
          </div>
        ) : (
          <div className="grid gap-6">
            {reports.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                functionCards={functionCards}
              />
            ))}
          </div>
        )}

        {reports.length > 0 && (
          <div className="mt-8 grid grid-cols-3 gap-4">
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
              <p className="text-xs text-slate-400 mb-1">总报告数</p>
              <p className="text-2xl font-bold text-white font-orbitron">
                {reports.length}
              </p>
            </div>
            <div className="bg-cyan-500/10 rounded-xl p-4 border border-cyan-500/30">
              <p className="text-xs text-cyan-400 mb-1">总得分</p>
              <p className="text-2xl font-bold text-cyan-400 font-orbitron">
                {reports.reduce((sum, r) => sum + r.score, 0)}
              </p>
            </div>
            <div className="bg-purple-500/10 rounded-xl p-4 border border-purple-500/30">
              <p className="text-xs text-purple-400 mb-1">最高连击</p>
              <p className="text-2xl font-bold text-purple-400 font-orbitron">
                {Math.max(...reports.map((r) => r.maxCombo), 0)}
              </p>
            </div>
          </div>
        )}

        <div className="mt-12 bg-slate-800/30 rounded-xl p-6 border border-slate-700/50">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <FileBarChart className="w-5 h-5 text-cyan-400" />
            报告命名规则
          </h3>
          <div className="text-slate-400 text-sm space-y-2">
            <p>
              报告文件命名格式：<code className="bg-slate-900 px-2 py-1 rounded text-cyan-400">函数怪兽躲避战_YYYYMMDD_批次号.格式</code>
            </p>
            <p>
              例如：<code className="bg-slate-900 px-2 py-1 rounded text-cyan-400">函数怪兽躲避战_20240530_BATCH-20240530-143022.pdf</code>
            </p>
            <p className="text-slate-500 mt-4">
              这种命名方式确保了报告文件按时间顺序排列，便于归档和查找，避免月底堆积在一起分不清。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
