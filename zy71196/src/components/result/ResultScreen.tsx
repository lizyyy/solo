import { useState, useRef } from 'react';
import { useGameStore } from '../../store/gameStore';
import { getFailureAnalysis } from '../../game/engine';
import { getScoreGrade } from '../../game/scoring';
import { generateInspectionReport, exportReportAsPDF, exportReportAsJSON } from '../../utils/export';
import type { InspectionReport } from '../../game/types';

interface ResultScreenProps {
  onRestart: () => void;
  onMainMenu: () => void;
  onViewReplay: () => void;
}

export function ResultScreen({ onRestart, onMainMenu, onViewReplay }: ResultScreenProps) {
  const { state, restartCurrentGame, exitToMenu } = useGameStore();
  const [showReport, setShowReport] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  if (!state) return null;

  const { grade, color } = getScoreGrade(state.score);
  const failureAnalysis = getFailureAnalysis(state);
  const report = generateInspectionReport(state);

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    setIsExporting(true);
    try {
      await exportReportAsPDF(reportRef.current, '屋顶巡检报告');
    } catch (error) {
      console.error('Export failed:', error);
    }
    setIsExporting(false);
  };

  const handleExportJSON = () => {
    exportReportAsJSON(report, '屋顶巡检报告');
  };

  const handleRestart = () => {
    restartCurrentGame();
    onRestart();
  };

  const handleExit = () => {
    exitToMenu();
    onMainMenu();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">
            {state.failed ? '任务失败' : '任务完成'}
          </h1>
          <p className="text-slate-400 text-lg">
            {state.failed
              ? state.failureReason || '发生漏水事故'
              : '成功完成屋顶排水巡检任务'}
          </p>
        </div>

        <div className="bg-slate-800 rounded-2xl p-8 mb-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-32 h-32 rounded-full bg-slate-700 mb-4">
              <span className={`text-6xl font-bold ${color}`}>{grade}</span>
            </div>
            <p className="text-5xl font-bold text-white mb-2">{state.score}</p>
            <p className="text-slate-400">总得分</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <div className="bg-slate-700/50 rounded-lg p-4 text-center">
              <p className="text-green-400 text-2xl font-bold">+{state.scoreBreakdown.inspectionScore}</p>
              <p className="text-slate-400 text-sm">巡检分</p>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-4 text-center">
              <p className="text-blue-400 text-2xl font-bold">+{state.scoreBreakdown.resolutionScore}</p>
              <p className="text-slate-400 text-sm">处置分</p>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-4 text-center">
              <p className="text-yellow-400 text-2xl font-bold">+{state.scoreBreakdown.efficiencyScore}</p>
              <p className="text-slate-400 text-sm">效率分</p>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-4 text-center">
              <p className="text-purple-400 text-2xl font-bold">+{state.scoreBreakdown.timeBonus}</p>
              <p className="text-slate-400 text-sm">时间奖励</p>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-4 text-center">
              <p className="text-red-400 text-2xl font-bold">-{Math.abs(state.scoreBreakdown.leakPenalty)}</p>
              <p className="text-slate-400 text-sm">漏水惩罚</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 text-center mb-8">
            <div className="bg-slate-700/30 rounded-lg p-4">
              <p className="text-white text-xl font-bold">{state.currentRound - 1}</p>
              <p className="text-slate-400 text-sm">完成回合</p>
            </div>
            <div className="bg-slate-700/30 rounded-lg p-4">
              <p className="text-white text-xl font-bold">{state.inspectedDrains.length}/{state.roofMap.drains.length}</p>
              <p className="text-slate-400 text-sm">巡检排水口</p>
            </div>
            <div className="bg-slate-700/30 rounded-lg p-4">
              <p className="text-white text-xl font-bold">{state.resolvedIssues.length}</p>
              <p className="text-slate-400 text-sm">处置隐患</p>
            </div>
          </div>
        </div>

        {failureAnalysis.length > 0 && (
          <div className="bg-red-900/30 border border-red-800 rounded-xl p-6 mb-8">
            <h3 className="text-red-400 font-bold text-lg mb-4">失败原因分析</h3>
            <ul className="space-y-2">
              {failureAnalysis.map((reason, index) => (
                <li key={index} className="flex items-start gap-2 text-red-300">
                  <span className="text-red-500">•</span>
                  {reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="bg-slate-800 rounded-2xl p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-bold text-lg">巡检报告</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setShowReport(!showReport)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
              >
                {showReport ? '隐藏报告' : '查看报告'}
              </button>
              <button
                onClick={handleExportPDF}
                disabled={isExporting}
                className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-slate-600 text-white rounded-lg transition-colors"
              >
                {isExporting ? '导出中...' : '导出PDF'}
              </button>
              <button
                onClick={handleExportJSON}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors"
              >
                导出JSON
              </button>
            </div>
          </div>

          {showReport && (
            <div ref={reportRef} className="bg-white rounded-lg p-8 text-slate-800 max-h-96 overflow-y-auto">
              <div className="text-center mb-6 border-b pb-4">
                <h2 className="text-2xl font-bold mb-2">屋顶排水巡检报告</h2>
                <p className="text-slate-600">{report.levelName}</p>
                <p className="text-slate-500 text-sm">{report.date}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-slate-100 p-3 rounded">
                  <p className="text-sm text-slate-600">巡检员</p>
                  <p className="font-bold">{report.inspectorName}</p>
                </div>
                <div className="bg-slate-100 p-3 rounded">
                  <p className="text-sm text-slate-600">综合评分</p>
                  <p className="font-bold">{report.score} 分 ({report.grade}级)</p>
                </div>
                <div className="bg-slate-100 p-3 rounded">
                  <p className="text-sm text-slate-600">排水口</p>
                  <p className="font-bold">{report.inspectedDrains}/{report.totalDrains}</p>
                </div>
                <div className="bg-slate-100 p-3 rounded">
                  <p className="text-sm text-slate-600">低洼区</p>
                  <p className="font-bold">{report.inspectedLowAreas}/{report.totalLowAreas}</p>
                </div>
              </div>

              <div className="mb-6">
                <h4 className="font-bold mb-2">发现隐患</h4>
                <p className="text-slate-600">共发现 {report.issuesFound} 处隐患，已处置 {report.issuesResolved} 处</p>
                {report.leakPoints.length > 0 && (
                  <p className="text-red-600 mt-2">
                    警告：发现 {report.leakPoints.length} 处漏水点，需立即维修
                  </p>
                )}
              </div>

              <div className="mb-6">
                <h4 className="font-bold mb-2">检查明细</h4>
                <div className="space-y-2">
                  {report.items.map((item) => (
                    <div key={item.id} className="border-l-4 border-slate-300 pl-3 py-1">
                      <div className="flex justify-between">
                        <span className="font-medium">
                          {item.type === 'drain' ? '排水口' : '低洼区'} ({item.position.x}, {item.position.y})
                        </span>
                        <span className={`text-sm ${
                          item.status === 'normal' ? 'text-green-600' :
                          item.status === 'resolved' ? 'text-blue-600' : 'text-red-600'
                        }`}>
                          {item.status === 'normal' ? '正常' :
                           item.status === 'resolved' ? '已处置' :
                           item.status === 'blocked' ? '堵塞' : '积水'}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600">{item.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-bold mb-2">整改建议</h4>
                <ul className="list-disc list-inside text-slate-600 space-y-1">
                  {report.recommendations.map((rec, i) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-4 justify-center">
          <button
            onClick={handleRestart}
            className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
          >
            重新挑战
          </button>
          <button
            onClick={onViewReplay}
            className="px-8 py-4 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
          >
            查看回放
          </button>
          <button
            onClick={handleExit}
            className="px-8 py-4 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
          >
            返回主菜单
          </button>
        </div>
      </div>
    </div>
  );
}
