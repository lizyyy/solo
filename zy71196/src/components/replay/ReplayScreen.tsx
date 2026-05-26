import { useState, useEffect, useMemo } from 'react';
import type { GameRecord, GameAction } from '../../game/types';
import { getKeyMoments, formatReplayTime } from '../../game/replay';
import { TOOL_CONFIG } from '../../game/config';

interface ReplayScreenProps {
  record: GameRecord;
  onBack: () => void;
}

export function ReplayScreen({ record, onBack }: ReplayScreenProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  const keyMoments = useMemo(() => getKeyMoments(record.actions), [record.actions]);
  const startTime = record.actions.length > 0 ? record.actions[0].timestamp : Date.now();
  const endTime = record.actions.length > 0 ? record.actions[record.actions.length - 1].timestamp : Date.now();
  const duration = endTime - startTime;

  useEffect(() => {
    if (!isPlaying || currentIndex >= record.actions.length - 1) {
      return;
    }

    const timer = setInterval(() => {
      setCurrentIndex((prev) => {
        if (prev >= record.actions.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1000 / playbackSpeed);

    return () => clearInterval(timer);
  }, [isPlaying, playbackSpeed, currentIndex, record.actions.length]);

  const currentAction = record.actions[currentIndex];
  const currentTime = currentAction ? currentAction.timestamp - startTime : 0;

  const handlePlayPause = () => {
    if (currentIndex >= record.actions.length - 1) {
      setCurrentIndex(0);
    }
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    setCurrentIndex(0);
    setIsPlaying(false);
  };

  const handleJumpToMoment = (action: GameAction) => {
    const index = record.actions.findIndex((a) => a.timestamp === action.timestamp);
    if (index !== -1) {
      setCurrentIndex(index);
      setIsPlaying(false);
    }
  };

  const getActionLabel = (action: GameAction): string => {
    switch (action.type) {
      case 'game_start':
        return '游戏开始';
      case 'round_end':
        return `第 ${action.round} 回合结束`;
      case 'rainfall_change':
        return `雨量变化: ${action.payload.rainfallIntensity}%`;
      case 'tool_use':
        return `使用 ${TOOL_CONFIG[action.payload.tool!]?.name || action.payload.tool} 工具`;
      case 'game_end':
        return '游戏结束';
      default:
        return action.type;
    }
  };

  const getActionColor = (action: GameAction): string => {
    if (action.type === 'tool_use' && action.payload.success) return 'text-green-400';
    if (action.type === 'round_end' && !action.payload.success) return 'text-red-400';
    if (action.type === 'rainfall_change') return 'text-blue-400';
    return 'text-slate-300';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">游戏回放</h1>
            <p className="text-slate-400">{record.levelName}</p>
          </div>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            返回
          </button>
        </div>

        <div className="bg-slate-800 rounded-xl p-6 mb-6">
          <div className="grid grid-cols-4 gap-4 text-center mb-6">
            <div className="bg-slate-700/50 rounded-lg p-4">
              <p className="text-slate-400 text-sm">得分</p>
              <p className="text-yellow-400 text-2xl font-bold">{record.score}</p>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-4">
              <p className="text-slate-400 text-sm">回合</p>
              <p className="text-white text-2xl font-bold">
                {record.completedRounds}/{record.totalRounds}
              </p>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-4">
              <p className="text-slate-400 text-sm">漏水点</p>
              <p className={`text-2xl font-bold ${record.leakCount > 0 ? 'text-red-400' : 'text-green-400'}`}>
                {record.leakCount}
              </p>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-4">
              <p className="text-slate-400 text-sm">结果</p>
              <p className={`text-2xl font-bold ${record.failed ? 'text-red-400' : 'text-green-400'}`}>
                {record.failed ? '失败' : '成功'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={handlePlayPause}
              className="w-16 h-16 bg-blue-600 hover:bg-blue-500 text-white rounded-full flex items-center justify-center text-2xl transition-colors"
            >
              {isPlaying ? '⏸' : '▶'}
            </button>
            <button
              onClick={handleReset}
              className="w-12 h-12 bg-slate-700 hover:bg-slate-600 text-white rounded-full flex items-center justify-center transition-colors"
            >
              ↺
            </button>
            <div className="flex-1">
              <input
                type="range"
                min={0}
                max={record.actions.length - 1}
                value={currentIndex}
                onChange={(e) => {
                  setCurrentIndex(parseInt(e.target.value));
                  setIsPlaying(false);
                }}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            <span className="text-slate-300 font-mono min-w-[80px]">
              {formatReplayTime(currentTime, 0)} / {formatReplayTime(duration, 0)}
            </span>
            <select
              value={playbackSpeed}
              onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
              className="bg-slate-700 text-white px-3 py-2 rounded-lg"
            >
              <option value={0.5}>0.5x</option>
              <option value={1}>1x</option>
              <option value={2}>2x</option>
              <option value={4}>4x</option>
            </select>
          </div>

          {currentAction && (
            <div className="bg-slate-700/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-sm">
                  第 {currentAction.round} 回合 · {formatReplayTime(currentTime, 0)}
                </span>
                <span className={`font-medium ${getActionColor(currentAction)}`}>
                  {getActionLabel(currentAction)}
                </span>
              </div>
              {currentAction.payload.message && (
                <p className="text-slate-300">{currentAction.payload.message}</p>
              )}
              <div className="mt-3 flex items-center gap-6 text-sm text-slate-400">
                <span>行动点: {currentAction.stateSnapshot.actionPoints}</span>
                <span>得分: {currentAction.stateSnapshot.score}</span>
                <span>已巡检: {currentAction.stateSnapshot.inspectedDrains.length}</span>
                <span>已处置: {currentAction.stateSnapshot.resolvedIssues.length}</span>
              </div>
            </div>
          )}
        </div>

        <div className="bg-slate-800 rounded-xl p-6">
          <h3 className="text-white font-bold text-lg mb-4">关键节点</h3>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {keyMoments.map((moment, index) => (
              <button
                key={index}
                onClick={() => handleJumpToMoment(moment.action)}
                className={`w-full text-left p-3 rounded-lg transition-colors ${
                  currentAction?.timestamp === moment.action.timestamp
                    ? 'bg-blue-600/30 border border-blue-500'
                    : 'bg-slate-700/50 hover:bg-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">{moment.label}</span>
                  <span className="text-slate-500 text-sm">
                    第 {moment.action.round} 回合
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
