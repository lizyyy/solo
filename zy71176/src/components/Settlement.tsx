import { useMemo, useState } from 'react';
import { useGameStore } from '../game/state';
import { getLevelById } from '../game/levels';
import { restartGame, returnToMenu, startReplay } from '../game/engine';
import { exportReportToJSON, exportReportToText } from '../utils/export';
import type { SettlementReport } from '../game/types';
import { Frown, Home, RotateCcw, Play, Download } from 'lucide-react';
import { ReplayPlayer } from './ReplayPlayer';

export function Settlement() {
  const score = useGameStore((state) => state.score);
  const complaints = useGameStore((state) => state.complaints);
  const satisfaction = useGameStore((state) => state.satisfaction);
  const currentLevel = useGameStore((state) => state.currentLevel);
  const failReason = useGameStore((state) => state.failReason);
  const events = useGameStore((state) => state.events);
  const history = useGameStore((state) => state.history);
  const currentTime = useGameStore((state) => state.currentTime);
  const guests = useGameStore((state) => state.guests);
  const status = useGameStore((state) => state.status);

  const [showReplay, setShowReplay] = useState(false);

  const level = getLevelById(currentLevel);

  const report = useMemo<SettlementReport>(() => {
    const won = !failReason &&
      satisfaction >= (level?.winConditions.minSatisfaction || 0) &&
      complaints <= (level?.winConditions.maxComplaints || 999) &&
      score >= (level?.winConditions.minScore || 0);

    const guestsServed = guests.filter((g) => g.status === 'checked-in' || g.status === 'checked-out').length;
    const roomsCleaned = history.filter((h) =>
      h.snapshot.events.some((e) => e.type === 'clean_complete')
    ).length;

    return {
      levelId: currentLevel,
      levelName: level?.name || '未知关卡',
      finalScore: score,
      totalComplaints: complaints,
      finalSatisfaction: satisfaction,
      guestsServed,
      roomsCleaned,
      won,
      failReason,
      keyEvents: events.slice(-20),
      playTime: currentTime,
    };
  }, [score, complaints, satisfaction, currentLevel, failReason, events, history, currentTime, guests, level]);

  const handleRestart = () => {
    restartGame();
    setShowReplay(false);
  };

  const handleReturnToMenu = () => {
    returnToMenu();
    setShowReplay(false);
  };

  const handleStartReplay = () => {
    startReplay();
    setShowReplay(true);
  };

  const handleExportJSON = () => {
    exportReportToJSON(report);
  };

  const handleExportText = () => {
    exportReportToText(report);
  };

  const getGrade = () => {
    if (report.finalScore >= 200) return { grade: 'S', color: 'text-yellow-400' };
    if (report.finalScore >= 150) return { grade: 'A', color: 'text-green-400' };
    if (report.finalScore >= 100) return { grade: 'B', color: 'text-blue-400' };
    if (report.finalScore >= 50) return { grade: 'C', color: 'text-purple-400' };
    return { grade: 'D', color: 'text-gray-400' };
  };

  const gradeInfo = getGrade();

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className={`p-8 text-center ${report.won ? 'bg-gradient-to-b from-green-900/50 to-transparent' : 'bg-gradient-to-b from-red-900/50 to-transparent'}`}>
          <div className="text-6xl mb-4">
            {report.won ? '🏆' : '💔'}
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">
            {report.won ? '恭喜通关！' : '挑战失败'}
          </h2>
          <p className="text-gray-400">{report.levelName}</p>
        </div>

        {report.failReason && (
          <div className="px-8 py-4 bg-red-900/30 border-y border-red-500/30">
            <div className="flex items-center gap-2 text-red-400">
              <Frown className="w-5 h-5" />
              <span>{report.failReason}</span>
            </div>
          </div>
        )}

        <div className="p-8">
          <div className="flex items-center justify-center gap-8 mb-8">
            <div className="text-center">
              <div className={`text-5xl font-bold ${gradeInfo.color}`}>
                {gradeInfo.grade}
              </div>
              <div className="text-xs text-gray-400 mt-1">评级</div>
            </div>

            <div className="h-16 w-px bg-gray-700"></div>

            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-400">
                {report.finalScore}
              </div>
              <div className="text-xs text-gray-400 mt-1">总分</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-gray-700/50 rounded-lg p-4">
              <div className="text-2xl font-bold text-red-400">{report.totalComplaints}</div>
              <div className="text-xs text-gray-400">客诉次数</div>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-400">{report.finalSatisfaction}%</div>
              <div className="text-xs text-gray-400">客人满意度</div>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-400">{report.guestsServed}</div>
              <div className="text-xs text-gray-400">服务客人</div>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-400">{report.playTime}</div>
              <div className="text-xs text-gray-400">游戏时长(分钟)</div>
            </div>
          </div>

          {status === 'replay' || showReplay ? (
            <ReplayPlayer />
          ) : (
            <>
              <div className="flex flex-wrap gap-3 justify-center mb-6">
                <button
                  onClick={handleRestart}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium text-white transition-colors"
                >
                  <RotateCcw className="w-5 h-5" /> 再来一局
                </button>

                <button
                  onClick={handleStartReplay}
                  disabled={history.length === 0}
                  className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium text-white transition-colors"
                >
                  <Play className="w-5 h-5" /> 历史回放
                </button>

                <button
                  onClick={handleReturnToMenu}
                  className="flex items-center gap-2 px-6 py-3 bg-gray-600 hover:bg-gray-500 rounded-lg font-medium text-white transition-colors"
                >
                  <Home className="w-5 h-5" /> 返回菜单
                </button>
              </div>

              <div className="flex flex-wrap gap-3 justify-center">
                <button
                  onClick={handleExportJSON}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-white transition-colors"
                >
                  <Download className="w-4 h-4" /> 导出 JSON
                </button>
                <button
                  onClick={handleExportText}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-white transition-colors"
                >
                  <Download className="w-4 h-4" /> 导出报告
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
