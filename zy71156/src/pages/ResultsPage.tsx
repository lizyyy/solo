import { useGameStore } from '@/store/gameStore';
import { useGameLoop } from '@/hooks/useGameLoop';
import { Navigate } from 'react-router-dom';
import {
  Trophy,
  XCircle,
  RotateCcw,
  Home,
  Download,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  FastForward,
  FileText,
  BarChart3,
  Users,
  Wrench,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import BuildingView from '@/components/BuildingView';
import EventLog from '@/components/EventLog';
import { useEffect, useRef, useState } from 'react';

export default function ResultsPage() {
  const {
    status,
    result,
    loseReason,
    scoreBreakdown,
    currentLevel,
    elevators,
    teams,
    events,
    score,
    history,
    replayIndex,
    replaySpeed,
    startReplay,
    stopReplay,
    setReplayIndex,
    setReplaySpeed,
    restartGame,
    goToMenu,
    exportReport,
  } = useGameStore();

  useGameLoop();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReplayView, setIsReplayView] = useState(false);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    if (status === 'replaying' && isPlaying) {
      const animate = () => {
        const state = useGameStore.getState();
        if (state.replayIndex < state.history.length - 1) {
          const nextIndex = Math.min(
            state.replayIndex + state.replaySpeed,
            state.history.length - 1
          );
          const frame = state.history[Math.floor(nextIndex)];
          if (frame) {
            useGameStore.setState({
              replayIndex: nextIndex,
              elevators: frame.elevators,
              teams: frame.teams,
              score: frame.score,
              gameTime: frame.gameTime,
            });
          }
          animationRef.current = requestAnimationFrame(animate);
        } else {
          setIsPlaying(false);
        }
      };
      animationRef.current = requestAnimationFrame(animate);

      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }
  }, [status, isPlaying, replaySpeed]);

  if (status === 'menu' || status === 'playing' || status === 'paused') {
    return <Navigate to="/game" replace />;
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getLoseReasonText = (reason: string | null) => {
    switch (reason) {
      case 'timeout':
        return '时间耗尽，未能完成所有救援';
      case 'passenger_panic':
        return '乘客等待时间过长，情绪失控';
      case 'too_many_conflicts':
        return '维保队冲突次数过多';
      default:
        return '未知原因';
    }
  };

  const handleExport = () => {
    const report = exportReport();
    const blob = new Blob([report], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `电梯救援报告_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleStartReplay = () => {
    startReplay();
    setIsReplayView(true);
    setIsPlaying(false);
  };

  const handleTogglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const index = parseInt(e.target.value);
    setReplayIndex(index);
    const frame = history[Math.floor(index)];
    if (frame) {
      useGameStore.setState({
        elevators: frame.elevators,
        teams: frame.teams,
        score: frame.score,
        gameTime: frame.gameTime,
      });
    }
  };

  const handleSpeedChange = (speed: number) => {
    setReplaySpeed(speed);
  };

  const handleStepBack = () => {
    setIsPlaying(false);
    const newIndex = Math.max(0, replayIndex - 1);
    setReplayIndex(newIndex);
    const frame = history[Math.floor(newIndex)];
    if (frame) {
      useGameStore.setState({
        elevators: frame.elevators,
        teams: frame.teams,
        score: frame.score,
        gameTime: frame.gameTime,
      });
    }
  };

  const handleStepForward = () => {
    setIsPlaying(false);
    const newIndex = Math.min(history.length - 1, replayIndex + 1);
    setReplayIndex(newIndex);
    const frame = history[Math.floor(newIndex)];
    if (frame) {
      useGameStore.setState({
        elevators: frame.elevators,
        teams: frame.teams,
        score: frame.score,
        gameTime: frame.gameTime,
      });
    }
  };

  if (isReplayView && status === 'replaying' && currentLevel) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0f1e3d] via-[#1a2a4a] to-[#0f1e3d] text-white p-4">
        <div className="max-w-full mx-auto space-y-4">
          <div className="bg-[#0a1628] rounded-xl p-4 border border-[#ff8a00]/20">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#ff8a00]/20 rounded-lg">
                  <FileText className="text-[#ff8a00]" size={24} />
                </div>
                <div>
                  <div className="text-xs text-gray-400">历史回放</div>
                  <div className="text-xl font-bold text-[#ff8a00] font-mono">{currentLevel.name}</div>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div>
                  <div className="text-xs text-gray-400">当前得分</div>
                  <div className="text-xl font-bold text-[#ff8a00] font-mono">{score}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">回放时间</div>
                  <div className="text-xl font-bold text-[#4caf50] font-mono">
                    {formatTime(history[Math.floor(replayIndex)]?.gameTime || 0)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    stopReplay();
                    setIsReplayView(false);
                    setIsPlaying(false);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-bold transition-colors"
                >
                  <XCircle size={18} />
                  退出回放
                </button>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-4">
              <button
                onClick={handleStepBack}
                className="p-2 bg-[#1a2a4a] hover:bg-[#2a3a5a] rounded-lg transition-colors"
              >
                <SkipBack size={20} />
              </button>
              <button
                onClick={handleTogglePlay}
                className="p-3 bg-[#ff8a00] hover:bg-[#ff9a20] rounded-full transition-colors"
              >
                {isPlaying ? <Pause size={24} /> : <Play size={24} />}
              </button>
              <button
                onClick={handleStepForward}
                className="p-2 bg-[#1a2a4a] hover:bg-[#2a3a5a] rounded-lg transition-colors"
              >
                <SkipForward size={20} />
              </button>

              <div className="flex-1 mx-4">
                <input
                  type="range"
                  min={0}
                  max={history.length - 1}
                  value={Math.floor(replayIndex)}
                  onChange={handleSeek}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[#ff8a00]"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>00:00</span>
                  <span>{formatTime(history[history.length - 1]?.gameTime || 0)}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <FastForward size={16} className="text-gray-400" />
                {[1, 2, 4, 8].map((speed) => (
                  <button
                    key={speed}
                    onClick={() => handleSpeedChange(speed)}
                    className={`px-3 py-1 rounded text-sm font-bold transition-colors ${
                      replaySpeed === speed
                        ? 'bg-[#ff8a00] text-white'
                        : 'bg-[#1a2a4a] text-gray-400 hover:text-white'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <BuildingView
                floorCount={currentLevel.floorCount}
                elevators={elevators}
                teams={teams}
              />
            </div>
            <div>
              <EventLog events={events} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f1e3d] via-[#1a2a4a] to-[#0f1e3d] text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full mb-4 bg-gradient-to-br from-[#ff8a00] to-[#ff4d4d]">
            {result === 'win' ? (
              <Trophy size={48} className="text-white" />
            ) : (
              <XCircle size={48} className="text-white" />
            )}
          </div>
          <h1 className="text-4xl font-bold mb-2">
            {result === 'win' ? (
              <span className="text-[#4caf50]">救援成功！</span>
            ) : (
              <span className="text-[#ff4d4d]">救援失败</span>
            )}
          </h1>
          {result === 'lose' && loseReason && (
            <p className="text-xl text-[#ff4d4d]">{getLoseReasonText(loseReason)}</p>
          )}
          {currentLevel && (
            <p className="text-gray-400 mt-2">
              关卡：{currentLevel.name} · 难度：{currentLevel.difficulty === 'easy' ? '简单' : currentLevel.difficulty === 'medium' ? '中等' : '困难'}
            </p>
          )}
        </div>

        {scoreBreakdown && (
          <div className="bg-[#0a1628] rounded-xl p-6 border border-[#ff8a00]/20 mb-6">
            <h2 className="text-xl font-bold mb-4 text-[#ff8a00] flex items-center gap-2">
              <BarChart3 size={24} />
              得分明细
            </h2>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-gray-400 mb-2">
                  <Trophy size={16} className="text-[#4caf50]" />
                  <span>得分项</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-[#4caf50]/10 rounded-lg border border-[#4caf50]/30">
                  <span className="text-white">成功救援 × {scoreBreakdown.totalRescues}</span>
                  <span className="text-[#4caf50] font-bold">+{scoreBreakdown.totalRescuePoints}</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-gray-400 mb-2">
                  <AlertTriangle size={16} className="text-[#ff4d4d]" />
                  <span>扣分项</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-[#ff4d4d]/10 rounded-lg border border-[#ff4d4d]/30">
                  <span className="text-white">维保队冲突 × {scoreBreakdown.totalConflicts}</span>
                  <span className="text-[#ff4d4d] font-bold">-{scoreBreakdown.totalConflictPenalty}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-[#ff4d4d]/10 rounded-lg border border-[#ff4d4d]/30">
                  <span className="text-white">乘客恐慌 × {scoreBreakdown.totalPanics}</span>
                  <span className="text-[#ff4d4d] font-bold">-{scoreBreakdown.totalPanicPenalty}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-[#ff4d4d]/10 rounded-lg border border-[#ff4d4d]/30">
                  <span className="text-white">救援超时 × {scoreBreakdown.totalTimeouts}</span>
                  <span className="text-[#ff4d4d] font-bold">-{scoreBreakdown.totalTimeoutPenalty}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-700">
              <div className="flex justify-between items-center p-4 bg-[#ff8a00]/20 rounded-lg border-2 border-[#ff8a00]">
                <span className="text-xl font-bold text-white">最终得分</span>
                <span className="text-3xl font-bold text-[#ff8a00] font-mono">
                  {scoreBreakdown.finalScore}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="bg-[#0a1628] rounded-xl p-6 border border-[#ff8a00]/20 mb-6">
          <h2 className="text-xl font-bold mb-4 text-[#ff8a00] flex items-center gap-2">
            <FileText size={24} />
            救援统计
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-[#1a2a4a] rounded-lg">
              <div className="text-3xl font-bold text-[#4caf50] font-mono">
                {events.filter((e) => e.type === 'rescue_complete').length}
              </div>
              <div className="text-sm text-gray-400 mt-1">成功救援</div>
            </div>
            <div className="text-center p-4 bg-[#1a2a4a] rounded-lg">
              <div className="text-3xl font-bold text-[#ff4d4d] font-mono">
                {events.filter((e) => e.type === 'fault').length}
              </div>
              <div className="text-sm text-gray-400 mt-1">故障总数</div>
            </div>
            <div className="text-center p-4 bg-[#1a2a4a] rounded-lg">
              <div className="text-3xl font-bold text-[#ffc107] font-mono">
                {events.filter((e) => e.type === 'conflict').length}
              </div>
              <div className="text-sm text-gray-400 mt-1">调度冲突</div>
            </div>
            <div className="text-center p-4 bg-[#1a2a4a] rounded-lg">
              <div className="text-3xl font-bold text-[#2196f3] font-mono">
                {events.filter((e) => e.type === 'mood_change').length}
              </div>
              <div className="text-sm text-gray-400 mt-1">情绪波动</div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
            <div className="text-center p-4 bg-[#1a2a4a] rounded-lg">
              <div className="flex items-center justify-center gap-2 text-2xl font-bold text-[#2196f3]">
                <Users size={24} />
                <span className="font-mono">{elevators.length}</span>
              </div>
              <div className="text-sm text-gray-400 mt-1">电梯数量</div>
            </div>
            <div className="text-center p-4 bg-[#1a2a4a] rounded-lg">
              <div className="flex items-center justify-center gap-2 text-2xl font-bold text-[#ff8a00]">
                <Wrench size={24} />
                <span className="font-mono">{teams.length}</span>
              </div>
              <div className="text-sm text-gray-400 mt-1">维保队伍</div>
            </div>
            <div className="text-center p-4 bg-[#1a2a4a] rounded-lg">
              <div className="flex items-center justify-center gap-2 text-2xl font-bold text-[#4caf50]">
                <Clock size={24} />
                <span className="font-mono">{formatTime(events[events.length - 1]?.time || 0)}</span>
              </div>
              <div className="text-sm text-gray-400 mt-1">总用时</div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-4">
          <button
            onClick={restartGame}
            className="flex items-center gap-2 px-6 py-3 bg-[#4caf50] hover:bg-[#5ccf60] text-white rounded-lg font-bold text-lg transition-colors"
          >
            <RotateCcw size={20} />
            再来一局
          </button>
          <button
            onClick={handleStartReplay}
            className="flex items-center gap-2 px-6 py-3 bg-[#2196f3] hover:bg-[#31a6ff] text-white rounded-lg font-bold text-lg transition-colors"
          >
            <Play size={20} />
            历史回放
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-6 py-3 bg-[#ff8a00] hover:bg-[#ff9a20] text-white rounded-lg font-bold text-lg transition-colors"
          >
            <Download size={20} />
            导出报告
          </button>
          <button
            onClick={goToMenu}
            className="flex items-center gap-2 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-bold text-lg transition-colors"
          >
            <Home size={20} />
            返回主菜单
          </button>
        </div>
      </div>
    </div>
  );
}
