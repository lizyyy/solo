import React from 'react';
import { useGameStore } from '@/store/gameStore';
import { getScoreGrade, explainScore } from '@/utils/scoring';
import { downloadReport } from '@/utils/report';
import { X, Download, RotateCcw, Home, History } from 'lucide-react';

export default function SettlementModal() {
  const {
    score,
    scoreBreakdown,
    failureReason,
    report,
    restartGame,
    goToMenu,
    setPhase,
  } = useGameStore();

  if (!report) return null;

  const grade = getScoreGrade(score);
  const explanations = explainScore(scoreBreakdown);

  const handleDownload = () => {
    downloadReport(report);
  };

  const handleReplay = () => {
    setPhase('replay');
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-night-panel rounded-2xl border border-night-border max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-night-panel border-b border-night-border p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-neon-yellow">
            {failureReason ? '💔 经营失败' : '🎉 经营结算'}
          </h2>
          <button
            onClick={goToMenu}
            className="p-2 rounded-lg hover:bg-night-border transition-colors"
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        <div className="p-6">
          <div className="flex items-center justify-center mb-6">
            <div
              className="w-32 h-32 rounded-full flex items-center justify-center text-5xl font-bold border-4"
              style={{ borderColor: grade.color, color: grade.color }}
            >
              {grade.grade}
            </div>
          </div>

          <div className="text-center mb-6">
            <div className="text-4xl font-bold text-white mb-2">{score} 分</div>
            <div className="text-lg" style={{ color: grade.color }}>
              {grade.description}
            </div>
          </div>

          {failureReason && (
            <div className="bg-neon-red/10 border border-neon-red/30 rounded-lg p-4 mb-6">
              <h3 className="text-neon-red font-bold mb-2">⚠️ 失败原因</h3>
              <p className="text-white">{failureReason.message}</p>
              <p className="text-gray-400 text-sm mt-1">{failureReason.detail}</p>
            </div>
          )}

          <div className="bg-night-card rounded-lg p-4 mb-6">
            <h3 className="text-neon-yellow font-bold mb-3">📊 评分明细</h3>
            <div className="space-y-2">
              {explanations.map((explanation, index) => (
                <p key={index} className="text-sm text-gray-300">
                  {explanation}
                </p>
              ))}
            </div>
          </div>

          <div className="bg-night-card rounded-lg p-4 mb-6">
            <h3 className="text-neon-cyan font-bold mb-3">📈 经营统计</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-neon-red">{report.totalPenalties}</div>
                <div className="text-xs text-gray-400">处罚次数</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-neon-orange">{report.totalWarnings}</div>
                <div className="text-xs text-gray-400">警告次数</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-neon-cyan">{report.totalRewards}</div>
                <div className="text-xs text-gray-400">奖励次数</div>
              </div>
            </div>
          </div>

          <div className="bg-night-card rounded-lg p-4 mb-6">
            <h3 className="text-neon-purple font-bold mb-3">🏪 摊位表现</h3>
            <div className="space-y-2">
              {report.stallPerformance.map((stall, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <span className="text-gray-300">{stall.name}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-gray-500">平均功率: {stall.avgPower}%</span>
                    <span className={stall.violations > 0 ? 'text-neon-red' : 'text-neon-cyan'}>
                      违规: {stall.violations}次
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 justify-center">
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 bg-neon-cyan/20 text-neon-cyan rounded-lg hover:bg-neon-cyan/30 transition-colors"
            >
              <Download size={18} />
              导出报告
            </button>
            <button
              onClick={handleReplay}
              className="flex items-center gap-2 px-4 py-2 bg-neon-purple/20 text-neon-purple rounded-lg hover:bg-neon-purple/30 transition-colors"
            >
              <History size={18} />
              历史回放
            </button>
            <button
              onClick={restartGame}
              className="flex items-center gap-2 px-4 py-2 bg-neon-orange/20 text-neon-orange rounded-lg hover:bg-neon-orange/30 transition-colors"
            >
              <RotateCcw size={18} />
              再来一局
            </button>
            <button
              onClick={goToMenu}
              className="flex items-center gap-2 px-4 py-2 bg-night-border text-gray-300 rounded-lg hover:bg-night-card transition-colors"
            >
              <Home size={18} />
              返回菜单
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}