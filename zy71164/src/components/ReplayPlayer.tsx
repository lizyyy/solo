import { useEffect, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';
import GameBoard from './GameBoard';
import { Play, Pause, SkipBack, SkipForward, Home, Download } from 'lucide-react';
import { exportGameReport, formatDuration } from '@/utils/export';

export default function ReplayPlayer() {
  const {
    gameState,
    replayState,
    setReplayTurn,
    toggleReplayPlay,
    stopReplay,
    gameEngine,
  } = useGameStore();

  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (replayState.isPlaying) {
      intervalRef.current = window.setInterval(() => {
        if (replayState.currentTurn < replayState.totalTurns) {
          setReplayTurn(replayState.currentTurn + 1);
        } else {
          toggleReplayPlay();
        }
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [replayState.isPlaying, replayState.currentTurn, replayState.totalTurns, setReplayTurn, toggleReplayPlay]);

  if (!gameState || !replayState.record) return null;

  const record = replayState.record;
  const isVictory = record.result === 'victory';

  const handleExport = () => {
    if (gameEngine) {
      const report = gameEngine.generateExportReport();
      exportGameReport(report);
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const turn = parseInt(e.target.value, 10);
    setReplayTurn(turn);
  };

  const handlePrev = () => {
    if (replayState.currentTurn > 0) {
      setReplayTurn(replayState.currentTurn - 1);
    }
  };

  const handleNext = () => {
    if (replayState.currentTurn < replayState.totalTurns) {
      setReplayTurn(replayState.currentTurn + 1);
    }
  };

  const handleFirst = () => {
    setReplayTurn(0);
  };

  const handleLast = () => {
    setReplayTurn(replayState.totalTurns);
  };

  return (
    <div className="min-h-screen bg-sonar-bg crt-effect flex flex-col items-center p-4 relative overflow-hidden">
      <div className="scanline-overlay" />

      <div className="w-full max-w-5xl z-10">
        <div className="text-center mb-4">
          <h1
            className="font-vt323 text-4xl text-sonar-cyan mb-2"
            style={{ textShadow: '0 0 15px #00ffff' }}
          >
            历史回放
          </h1>
          <p className="text-sonar-cyan/70 font-jetbrains text-sm">
            {record.levelName} | {isVictory ? '胜利' : '失败'} | {record.score}分
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-4 mb-4">
          <div className="lg:col-span-2">
            <GameBoard width={600} height={600} isReplay={true} />
          </div>

          <div className="space-y-4">
            <div className="panel">
              <h3 className="panel-title">回放控制</h3>

              <div className="mb-4">
                <div className="flex justify-between text-xs font-jetbrains text-sonar-green/70 mb-2">
                  <span>回合 {replayState.currentTurn + 1}</span>
                  <span>/ {replayState.totalTurns + 1}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={replayState.totalTurns}
                  value={replayState.currentTurn}
                  onChange={handleSliderChange}
                  className="w-full h-2 bg-sonar-dark rounded-lg appearance-none cursor-pointer accent-sonar-cyan"
                />
              </div>

              <div className="flex justify-center gap-2 mb-4">
                <button
                  onClick={handleFirst}
                  className="military-btn p-2"
                  title="第一帧"
                >
                  <SkipBack className="w-4 h-4" />
                </button>
                <button
                  onClick={handlePrev}
                  className="military-btn p-2"
                  title="上一帧"
                >
                  <SkipBack className="w-4 h-4" />
                </button>
                <button
                  onClick={toggleReplayPlay}
                  className="military-btn p-2"
                  title={replayState.isPlaying ? '暂停' : '播放'}
                >
                  {replayState.isPlaying ? (
                    <Pause className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={handleNext}
                  className="military-btn p-2"
                  title="下一帧"
                >
                  <SkipForward className="w-4 h-4" />
                </button>
                <button
                  onClick={handleLast}
                  className="military-btn p-2"
                  title="最后一帧"
                >
                  <SkipForward className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-jetbrains">
                <div className="text-sonar-green/70">当前回合</div>
                <div className="text-sonar-green text-right">
                  {gameState.currentTurn}
                </div>
                <div className="text-sonar-green/70">剩余能量</div>
                <div className="text-sonar-amber text-right">
                  {gameState.energy}
                </div>
                <div className="text-sonar-green/70">已消灭目标</div>
                <div className="text-sonar-green text-right">
                  {gameState.destroyedTargets}
                </div>
                <div className="text-sonar-green/70">当前得分</div>
                <div className="text-sonar-amber text-right">
                  {gameState.score}
                </div>
              </div>
            </div>

            <div className="panel">
              <h3 className="panel-title">游戏信息</h3>
              <div className="space-y-2 text-sm font-jetbrains">
                <div className="flex justify-between">
                  <span className="text-sonar-green/70">关卡</span>
                  <span className="text-sonar-green">{record.levelName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sonar-green/70">难度</span>
                  <span className="text-sonar-green">
                    {record.difficulty === 'easy'
                      ? '初级'
                      : record.difficulty === 'medium'
                      ? '中级'
                      : '高级'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sonar-green/70">结果</span>
                  <span
                    style={{
                      color: isVictory ? 'var(--sonar-green)' : 'var(--sonar-red)',
                    }}
                  >
                    {isVictory ? '胜利' : '失败'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sonar-green/70">最终得分</span>
                  <span className="text-sonar-amber">{record.score}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sonar-green/70">总回合数</span>
                  <span className="text-sonar-green">{record.turns}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sonar-green/70">用时</span>
                  <span className="text-sonar-green">
                    {formatDuration(record.duration)}
                  </span>
                </div>
                {record.defeatReason && (
                  <div className="pt-2 border-t border-sonar-green/20">
                    <span className="text-sonar-red text-xs">{record.defeatReason}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleExport}
                className="military-btn amber flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                导出报告
              </button>
              <button
                onClick={stopReplay}
                className="military-btn red flex items-center justify-center gap-2"
              >
                <Home className="w-4 h-4" />
                返回菜单
              </button>
            </div>
          </div>
        </div>

        <div className="panel">
          <h3 className="panel-title">目标轨迹</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {gameState.targets.map((target, index) => (
              <div
                key={target.id}
                className={`p-3 rounded border ${
                  target.isDestroyed
                    ? 'border-sonar-red/50 bg-sonar-red/5'
                    : target.hasEscaped
                    ? 'border-sonar-amber/50 bg-sonar-amber/5'
                    : 'border-sonar-green/50 bg-sonar-green/5'
                }`}
              >
                <div className="font-vt323 text-lg text-sonar-green mb-1">
                  目标 #{index + 1}
                </div>
                <div className="text-xs font-jetbrains space-y-1">
                  <div className="flex justify-between">
                    <span className="text-sonar-green/60">状态</span>
                    <span
                      className={
                        target.isDestroyed
                          ? 'text-sonar-red'
                          : target.hasEscaped
                          ? 'text-sonar-amber'
                          : 'text-sonar-green'
                      }
                    >
                      {target.isDestroyed
                        ? '已摧毁'
                        : target.hasEscaped
                        ? '已逃脱'
                        : '存活'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sonar-green/60">位置</span>
                    <span className="text-sonar-green">
                      ({target.position.x}, {target.position.y})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sonar-green/60">轨迹点</span>
                    <span className="text-sonar-green">{target.trajectory.length}</span>
                  </div>
                  {target.wasDetected && (
                    <div className="flex justify-between">
                      <span className="text-sonar-green/60">发现</span>
                      <span className="text-sonar-cyan">是</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
