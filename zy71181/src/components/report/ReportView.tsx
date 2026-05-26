import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../../store/useGameStore';
import { ScoreCalculator } from '../../game/engine/ScoreCalculator';
import { getLevelById } from '../../game/data/levels';
import { WEATHER_NAMES, INJURY_NAMES } from '../../game/data/constants';
import { EQUIPMENT_LIST } from '../../game/data/equipment';

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}分${secs}秒`;
};

export function ReportView() {
  const navigate = useNavigate();
  const { gameState, generateReport, exportReportJSON, currentGameId } = useGameStore();
  const report = generateReport();
  const level = getLevelById(gameState.currentLevelId);
  const rating = ScoreCalculator.getFinalRating(gameState.score, gameState.victims.length);

  const ratingColors: Record<string, string> = {
    S: 'text-yellow-400',
    A: 'text-green-400',
    B: 'text-blue-400',
    C: 'text-orange-400',
    D: 'text-red-400',
  };

  const handleExportJSON = () => {
    const json = exportReportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rescue-report-${currentGameId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-blue-900 to-slate-900 p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/result')}
            className="text-slate-300 hover:text-white flex items-center gap-2"
          >
            ← 返回结果
          </button>
          <h1 className="text-2xl font-bold text-white">救援任务报告</h1>
          <button
            onClick={handleExportJSON}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm"
          >
            💾 导出JSON
          </button>
        </div>

        <div className="bg-slate-800/80 rounded-2xl p-6 mb-6">
          <div className="text-center mb-8">
            <div className={`text-6xl font-bold ${ratingColors[rating]} mb-2`}>
              {rating}
            </div>
            <h2 className="text-2xl font-bold text-white">{level?.name}</h2>
            <p className="text-slate-400 mt-1">
              任务{report.result === 'victory' ? '成功完成' : '失败'}
            </p>
          </div>

          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="bg-slate-700/50 rounded-xl p-4 text-center">
              <p className="text-slate-400 text-sm">最终得分</p>
              <p className="text-3xl font-bold text-yellow-400">{report.finalScore}</p>
            </div>
            <div className="bg-slate-700/50 rounded-xl p-4 text-center">
              <p className="text-slate-400 text-sm">用时</p>
              <p className="text-2xl font-bold text-white">{formatTime(report.totalTime)}</p>
            </div>
            <div className="bg-slate-700/50 rounded-xl p-4 text-center">
              <p className="text-slate-400 text-sm">救援成功</p>
              <p className="text-2xl font-bold text-green-400">
                {report.victimsRescued}/{report.totalVictims}
              </p>
            </div>
            <div className="bg-slate-700/50 rounded-xl p-4 text-center">
              <p className="text-slate-400 text-sm">派遣次数</p>
              <p className="text-2xl font-bold text-white">{report.dispatchCount}</p>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-white font-semibold mb-3">得分构成</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-300">基础救援分</span>
                <span className="text-green-400">+{report.scoreBreakdown.baseRescue}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">速度奖励</span>
                <span className="text-green-400">+{report.scoreBreakdown.speedBonus}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">装备匹配奖励</span>
                <span className="text-green-400">+{report.scoreBreakdown.equipmentBonus}</span>
              </div>
              {report.scoreBreakdown.deteriorationPenalty > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">伤情恶化惩罚</span>
                  <span className="text-red-400">-{report.scoreBreakdown.deteriorationPenalty}</span>
                </div>
              )}
              {report.scoreBreakdown.failurePenalty > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">救援失败惩罚</span>
                  <span className="text-red-400">-{report.scoreBreakdown.failurePenalty}</span>
                </div>
              )}
              <div className="border-t border-slate-600 pt-3 flex items-center justify-between font-bold">
                <span className="text-white">总计</span>
                <span className="text-yellow-400 text-xl">{report.finalScore}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/80 rounded-2xl p-6 mb-6">
          <h3 className="text-white font-semibold mb-4">装备使用统计</h3>
          <div className="grid grid-cols-3 gap-3">
            {EQUIPMENT_LIST.map((eq) => {
              const count = report.equipmentUsage[eq.type] || 0;
              return (
                <div
                  key={eq.type}
                  className={`p-3 rounded-lg text-center ${
                    count > 0 ? 'bg-blue-600/30' : 'bg-slate-700/30'
                  }`}
                >
                  <span className="text-2xl">{eq.icon}</span>
                  <p className="text-white text-sm mt-1">{eq.name}</p>
                  <p className={`text-sm ${count > 0 ? 'text-blue-400' : 'text-slate-500'}`}>
                    {count}次
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-slate-800/80 rounded-2xl p-6 mb-6">
          <h3 className="text-white font-semibold mb-4">救援事件时间线</h3>
          <div className="space-y-4">
            {report.events.map((event, index) => (
              <div key={index} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      event.type === 'rescue'
                        ? 'bg-green-500'
                        : event.type === 'dispatch'
                        ? 'bg-blue-500'
                        : event.type === 'deterioration'
                        ? 'bg-orange-500'
                        : event.type === 'weather_change'
                        ? 'bg-purple-500'
                        : event.type === 'victory'
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}
                  />
                  {index < report.events.length - 1 && (
                    <div className="w-0.5 h-full bg-slate-600" />
                  )}
                </div>
                <div className="flex-1 pb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-slate-400 text-sm font-mono">
                      {formatTime(event.timestamp)}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${
                        event.type === 'rescue'
                          ? 'bg-green-600 text-white'
                          : event.type === 'dispatch'
                          ? 'bg-blue-600 text-white'
                          : event.type === 'deterioration'
                          ? 'bg-orange-600 text-white'
                          : event.type === 'weather_change'
                          ? 'bg-purple-600 text-white'
                          : event.type === 'victory'
                          ? 'bg-yellow-600 text-white'
                          : 'bg-red-600 text-white'
                      }`}
                    >
                      {event.type === 'rescue'
                        ? '救援成功'
                        : event.type === 'dispatch'
                        ? '派遣'
                        : event.type === 'deterioration'
                        ? '伤情恶化'
                        : event.type === 'weather_change'
                        ? '天气变化'
                        : event.type === 'victory'
                        ? '胜利'
                        : '失败'}
                    </span>
                  </div>
                  <p className="text-slate-300 text-sm">
                    {event.type === 'rescue' &&
                      `${event.data.victimName} 救援成功，获得 ${event.data.score} 分`}
                    {event.type === 'dispatch' && `巡逻员出发执行救援任务`}
                    {event.type === 'deterioration' && `${event.data.victimName} 伤情开始恶化`}
                    {event.type === 'weather_change' &&
                      `天气变为 ${WEATHER_NAMES[event.data.weather as string] || event.data.weather}`}
                    {event.type === 'victory' && `任务完成！最终得分: ${event.data.score}`}
                    {event.type === 'defeat' && `任务失败: ${event.data.reason}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {report.defeatReason && (
          <div className="bg-red-900/30 border border-red-500/50 rounded-2xl p-6 mb-6">
            <h3 className="text-red-400 font-semibold mb-2">失败原因</h3>
            <p className="text-white">{report.defeatReason}</p>
          </div>
        )}

        <div className="flex justify-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-slate-600 hover:bg-slate-500 text-white rounded-xl font-medium transition-all"
          >
            🏠 返回主菜单
          </button>
        </div>
      </div>
    </div>
  );
}
