import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, XCircle, Download, RotateCcw, Home, Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { ReservoirCanvas } from '../components/game/ReservoirCanvas';
import { SCORE_WEIGHTS } from '../engine/constants';

export function ResultPage() {
  const navigate = useNavigate();
  const {
    gameRecord,
    currentLevel,
    currentState,
    history,
    replayIndex,
    startReplay,
    setReplayIndex,
    stopReplay,
    restartGame,
    resetAll,
    exportReport,
    gameStatus,
  } = useGameStore();

  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1);

  useEffect(() => {
    if (gameRecord && gameStatus !== 'replaying') {
      startReplay(gameRecord);
    }
  }, [gameRecord, gameStatus, startReplay]);

  useEffect(() => {
    if (!gameRecord && gameStatus === 'idle') {
      navigate('/');
    }
  }, [gameRecord, gameStatus, navigate]);

  useEffect(() => {
    if (!isPlaying || gameStatus !== 'replaying') return;

    const interval = setInterval(() => {
      setReplayIndex(replayIndex + 1);
      if (replayIndex >= history.length - 1) {
        setIsPlaying(false);
      }
    }, 100 / playSpeed);

    return () => clearInterval(interval);
  }, [isPlaying, playSpeed, replayIndex, history.length, setReplayIndex, gameStatus]);

  const handleExport = () => {
    const report = exportReport();
    if (!report) return;

    const blob = new Blob([report], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `水库调度报告_${gameRecord?.levelName}_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRestart = () => {
    stopReplay();
    restartGame();
    navigate('/game');
  };

  const handleBack = () => {
    stopReplay();
    resetAll();
    navigate('/');
  };

  if (!gameRecord || !currentLevel) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <p className="text-slate-400">加载中...</p>
      </div>
    );
  }

  const { finalScore, isWin, failureReason } = gameRecord;

  return (
    <div className="min-h-screen bg-slate-900">
      <header className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">
            {isWin ? '🎉 调度完成' : '💥 调度失败'}
          </h1>
          <div className="flex items-center gap-3">
            <span className="text-slate-400">{gameRecord.levelName}</span>
            <button
              onClick={handleBack}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-all"
            >
              返回选关
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className={`rounded-xl p-6 ${
              isWin ? 'bg-gradient-to-br from-green-900/50 to-slate-800' : 'bg-gradient-to-br from-red-900/50 to-slate-800'
            } border ${isWin ? 'border-green-700' : 'border-red-700'}`}>
              <div className="flex items-center gap-4 mb-4">
                {isWin ? (
                  <Trophy className="w-16 h-16 text-amber-400" />
                ) : (
                  <XCircle className="w-16 h-16 text-red-400" />
                )}
                <div>
                  <div className="text-5xl font-bold text-white mb-1">
                    {finalScore.total}
                    <span className="text-2xl text-slate-400"> / 100</span>
                  </div>
                  <p className="text-slate-400">
                    {isWin ? '恭喜！你成功完成了水库调度任务。' : '调度任务失败，请重新尝试。'}
                  </p>
                </div>
              </div>
              {!isWin && failureReason && (
                <div className="bg-red-950/50 border border-red-800 rounded-lg p-3">
                  <p className="text-red-300 text-sm">{failureReason}</p>
                </div>
              )}
            </div>

            <div className="bg-slate-800 rounded-xl p-6">
              <h2 className="text-lg font-bold text-white mb-4">评分详情</h2>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-400">最终库容达标</span>
                    <span className="text-white font-mono">{finalScore.storageScore} / {SCORE_WEIGHTS.STORAGE}</span>
                  </div>
                  <div className="w-full h-3 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all"
                      style={{ width: `${(finalScore.storageScore / SCORE_WEIGHTS.STORAGE) * 100}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-400">下游安全防护</span>
                    <span className="text-white font-mono">{finalScore.downstreamScore} / {SCORE_WEIGHTS.DOWNSTREAM}</span>
                  </div>
                  <div className="w-full h-3 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 transition-all"
                      style={{ width: `${(finalScore.downstreamScore / SCORE_WEIGHTS.DOWNSTREAM) * 100}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-400">蓄水利用效率</span>
                    <span className="text-white font-mono">{finalScore.efficiencyScore} / {SCORE_WEIGHTS.EFFICIENCY}</span>
                  </div>
                  <div className="w-full h-3 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 transition-all"
                      style={{ width: `${(finalScore.efficiencyScore / SCORE_WEIGHTS.EFFICIENCY) * 100}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-400">调度平稳性</span>
                    <span className="text-white font-mono">{finalScore.stabilityScore} / {SCORE_WEIGHTS.STABILITY}</span>
                  </div>
                  <div className="w-full h-3 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 transition-all"
                      style={{ width: `${(finalScore.stabilityScore / SCORE_WEIGHTS.STABILITY) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-700">
                <h3 className="text-sm font-medium text-slate-400 mb-3">调度统计</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-slate-700/50 rounded-lg p-3">
                    <div className="text-slate-500 mb-1">最终库容</div>
                    <div className="text-white font-mono">{finalScore.details.finalStorage.toFixed(0)} 万m³</div>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-3">
                    <div className="text-slate-500 mb-1">最大泄流</div>
                    <div className="text-white font-mono">{finalScore.details.maxDownstreamDischarge.toFixed(0)} m³/s</div>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-3">
                    <div className="text-slate-500 mb-1">闸门操作</div>
                    <div className="text-white font-mono">{finalScore.details.gateChanges} 次</div>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-3">
                    <div className="text-slate-500 mb-1">超警次数</div>
                    <div className="text-white font-mono">{finalScore.details.dangerEvents} 次</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleRestart}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-all"
              >
                <RotateCcw size={18} />
                重新挑战
              </button>
              <button
                onClick={handleExport}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-all"
              >
                <Download size={18} />
                导出报告
              </button>
              <button
                onClick={handleBack}
                className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-all"
              >
                <Home size={18} />
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-slate-800 rounded-xl p-4">
              <h2 className="text-lg font-bold text-white mb-4">历史回放</h2>
              <div className="flex justify-center mb-4">
                <ReservoirCanvas
                  state={currentState}
                  level={currentLevel}
                  width={520}
                  height={320}
                />
              </div>

              <div className="flex items-center justify-center gap-4 mb-4">
                <button
                  onClick={() => setReplayIndex(0)}
                  className="p-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all"
                >
                  <SkipBack size={20} />
                </button>
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-full transition-all"
                >
                  {isPlaying ? <Pause size={24} /> : <Play size={24} />}
                </button>
                <button
                  onClick={() => setReplayIndex(history.length - 1)}
                  className="p-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all"
                >
                  <SkipForward size={20} />
                </button>
                <div className="flex items-center gap-2 ml-4">
                  <span className="text-slate-400 text-sm">速度:</span>
                  {[0.5, 1, 2, 4].map((speed) => (
                    <button
                      key={speed}
                      onClick={() => setPlaySpeed(speed)}
                      className={`px-2 py-1 rounded text-sm transition-all ${
                        playSpeed === speed
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                      }`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <input
                  type="range"
                  min="0"
                  max={history.length - 1}
                  value={replayIndex}
                  onChange={(e) => {
                    setIsPlaying(false);
                    setReplayIndex(Number(e.target.value));
                  }}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer
                    [&::-webkit-slider-thumb]:appearance-none
                    [&::-webkit-slider-thumb]:w-4
                    [&::-webkit-slider-thumb]:h-4
                    [&::-webkit-slider-thumb]:rounded-full
                    [&::-webkit-slider-thumb]:bg-blue-500
                    [&::-webkit-slider-thumb]:cursor-pointer"
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>第 0 小时</span>
                  <span>第 {replayIndex} 小时</span>
                  <span>第 {history.length - 1} 小时</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-800 rounded-xl p-4">
              <h3 className="text-sm font-medium text-slate-400 mb-3">闸门操作记录</h3>
              <div className="max-h-40 overflow-y-auto space-y-2">
                {gameRecord.gateChanges.length === 0 ? (
                  <p className="text-slate-500 text-sm">无闸门操作记录</p>
                ) : (
                  gameRecord.gateChanges.slice().reverse().map((change, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between bg-slate-700/50 rounded px-3 py-2 text-sm"
                    >
                      <span className="text-slate-400">第 {change.time} 小时</span>
                      <span className="text-blue-400 font-mono">闸门调节至 {change.opening.toFixed(0)}%</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
