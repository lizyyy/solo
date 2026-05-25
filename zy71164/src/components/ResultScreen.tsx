import { useGameStore } from '@/store/gameStore';
import { exportGameReport, formatDuration } from '@/utils/export';
import { Trophy, XCircle, Download, RotateCcw, Home, Play, BarChart3, Target, Zap, Clock } from 'lucide-react';

export default function ResultScreen() {
  const { gameState, gameEngine, restartGame, resetStore, startReplay, historyRecords } =
    useGameStore();

  if (!gameState || !gameEngine) return null;

  const scoreResult = gameEngine.getScoreResult();
  const isVictory = gameState.gameStatus === 'victory';
  const duration = gameState.endTime
    ? (gameState.endTime - gameState.startTime) / 1000
    : 0;

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'S':
        return '#ffd700';
      case 'A':
        return '#39ff14';
      case 'B':
        return '#00ffff';
      case 'C':
        return '#ffb000';
      case 'D':
        return '#ff3333';
      default:
        return '#39ff14';
    }
  };

  const handleExport = () => {
    const report = gameEngine.generateExportReport();
    exportGameReport(report);
  };

  const handleReplay = () => {
    const latestRecord = historyRecords[0];
    if (latestRecord) {
      startReplay(latestRecord);
    }
  };

  const handleRestart = () => {
    restartGame();
  };

  const handleMenu = () => {
    resetStore();
  };

  const breakdownItems = [
    { label: '基础得分', value: scoreResult.breakdown.baseScore, color: 'text-sonar-green' },
    { label: '消灭目标', value: scoreResult.breakdown.targetKills, color: 'text-sonar-green' },
    { label: '首次发现奖励', value: scoreResult.breakdown.firstDetectionBonus, color: 'text-sonar-cyan' },
    { label: '剩余能量奖励', value: scoreResult.breakdown.energyBonus, color: 'text-sonar-green' },
    { label: '回合奖励', value: scoreResult.breakdown.turnBonus, color: 'text-sonar-cyan' },
    { label: '惩罚扣分', value: -scoreResult.breakdown.penalties, color: 'text-sonar-red' },
  ];

  const statItems = [
    { icon: Target, label: '命中率', value: `${Math.round(scoreResult.statistics.hitRate * 100)}%` },
    { icon: Zap, label: '能量效率', value: scoreResult.statistics.energyEfficiency.toFixed(2) },
    { icon: BarChart3, label: '扫描次数', value: scoreResult.statistics.scansPerformed },
    { icon: Target, label: '攻击次数', value: scoreResult.statistics.attacksPerformed },
    { icon: Clock, label: '总用时', value: formatDuration(duration) },
  ];

  return (
    <div className="min-h-screen bg-sonar-bg crt-effect flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="scanline-overlay" />

      <div className="w-full max-w-4xl z-10">
        <div className="text-center mb-8">
          {isVictory ? (
            <>
              <Trophy
                className="w-20 h-20 mx-auto mb-4 text-sonar-amber"
                style={{ filter: 'drop-shadow(0 0 20px #ffb000)' }}
              />
              <h1
                className="font-vt323 text-6xl text-sonar-amber mb-2"
                style={{ textShadow: '0 0 20px #ffb000, 0 0 40px #ffb000' }}
              >
                任务完成
              </h1>
              <p className="text-sonar-amber/70 font-jetbrains">所有敌方潜艇已被消灭</p>
            </>
          ) : (
            <>
              <XCircle
                className="w-20 h-20 mx-auto mb-4 text-sonar-red"
                style={{ filter: 'drop-shadow(0 0 20px #ff3333)' }}
              />
              <h1
                className="font-vt323 text-6xl text-sonar-red mb-2"
                style={{ textShadow: '0 0 20px #ff3333, 0 0 40px #ff3333' }}
              >
                任务失败
              </h1>
              <p className="text-sonar-red/70 font-jetbrains">{gameState.defeatReason}</p>
            </>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div className="panel">
            <h3 className="panel-title">综合评分</h3>

            <div className="text-center mb-6">
              <div
                className="font-vt323 text-8xl mb-2"
                style={{
                  color: getGradeColor(scoreResult.grade),
                  textShadow: `0 0 30px ${getGradeColor(scoreResult.grade)}, 0 0 60px ${getGradeColor(scoreResult.grade)}`,
                }}
              >
                {scoreResult.grade}
              </div>
              <div
                className="font-vt323 text-4xl text-sonar-green"
                style={{ textShadow: '0 0 15px #39ff14' }}
              >
                {scoreResult.totalScore} 分
              </div>
            </div>

            <div className="space-y-2">
              {breakdownItems.map((item, index) => (
                <div key={index} className="flex justify-between items-center">
                  <span className="text-sonar-green/70 font-jetbrains text-sm">
                    {item.label}
                  </span>
                  <span className={`font-jetbrains text-sm ${item.color}`}>
                    {item.value >= 0 ? '+' : ''}
                    {item.value}
                  </span>
                </div>
              ))}
              <div className="border-t border-sonar-green/30 pt-2 mt-2">
                <div className="flex justify-between items-center">
                  <span className="text-sonar-green font-jetbrains text-sm font-bold">
                    总分
                  </span>
                  <span
                    className="font-jetbrains text-lg font-bold text-sonar-green"
                    style={{ textShadow: '0 0 10px #39ff14' }}
                  >
                    {scoreResult.totalScore}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="panel">
            <h3 className="panel-title">战斗统计</h3>

            <div className="grid grid-cols-2 gap-3 mb-4">
              {statItems.map((item, index) => (
                <div
                  key={index}
                  className="text-center p-3 bg-sonar-dark/50 rounded border border-sonar-green/20"
                >
                  <item.icon className="w-5 h-5 mx-auto mb-1 text-sonar-cyan" />
                  <div className="text-sonar-green/60 font-jetbrains text-xs mb-1">
                    {item.label}
                  </div>
                  <div className="font-vt323 text-xl text-sonar-green">{item.value}</div>
                </div>
              ))}
            </div>

            <div className="border-t border-sonar-green/30 pt-4">
              <h4 className="font-vt323 text-lg text-sonar-green mb-3">目标情况</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sonar-green/70 font-jetbrains text-sm">
                    关卡
                  </span>
                  <span className="text-sonar-green font-jetbrains text-sm">
                    {gameState.level.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sonar-green/70 font-jetbrains text-sm">
                    总回合数
                  </span>
                  <span className="text-sonar-green font-jetbrains text-sm">
                    {gameState.currentTurn}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sonar-green/70 font-jetbrains text-sm">
                    消灭目标
                  </span>
                  <span className="text-sonar-green font-jetbrains text-sm">
                    {gameState.destroyedTargets} / {gameState.targets.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sonar-green/70 font-jetbrains text-sm">
                    逃脱目标
                  </span>
                  <span
                    className={`font-jetbrains text-sm ${
                      gameState.escapedTargets > 0 ? 'text-sonar-red' : 'text-sonar-green'
                    }`}
                  >
                    {gameState.escapedTargets}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sonar-green/70 font-jetbrains text-sm">
                    未命中攻击
                  </span>
                  <span className="text-sonar-amber font-jetbrains text-sm">
                    {gameState.missedAttacks}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sonar-green/70 font-jetbrains text-sm">
                    剩余能量
                  </span>
                  <span className="text-sonar-amber font-jetbrains text-sm">
                    {gameState.energy}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="panel mb-6">
          <h3 className="panel-title">最终海域态势</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-sonar-cyan font-jetbrains text-sm mb-1">玩家位置</div>
              <div className="font-vt323 text-xl text-sonar-cyan">(0, 0)</div>
            </div>
            <div>
              <div className="text-sonar-green font-jetbrains text-sm mb-1">已消灭目标</div>
              <div className="font-vt323 text-xl text-sonar-green">{gameState.destroyedTargets}</div>
            </div>
            <div>
              <div className="text-sonar-amber font-jetbrains text-sm mb-1">噪声源数量</div>
              <div className="font-vt323 text-xl text-sonar-amber">
                {gameState.noiseSources.length}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button
            onClick={handleReplay}
            className="military-btn flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4" />
            轨迹回放
          </button>
          <button
            onClick={handleExport}
            className="military-btn amber flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            导出报告
          </button>
          <button
            onClick={handleRestart}
            className="military-btn flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            再来一局
          </button>
          <button
            onClick={handleMenu}
            className="military-btn red flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" />
            返回主菜单
          </button>
        </div>
      </div>
    </div>
  );
}
