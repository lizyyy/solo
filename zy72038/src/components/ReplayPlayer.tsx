import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Gauge,
  Clock,
  MousePointer2,
  Shield,
  Lock,
  Database,
  Eye,
  XCircle,
  CheckCircle2,
} from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { formatTime, TOWER_CONFIG } from '@/utils/gameUtils';
import { ActionRecord } from '@/types/game';

const towerIcons: Record<string, React.ReactNode> = {
  firewall: <Shield className="w-4 h-4" />,
  encryption: <Lock className="w-4 h-4" />,
  backup: <Database className="w-4 h-4" />,
  monitor: <Eye className="w-4 h-4" />,
};

export const ReplayPlayer: React.FC = () => {
  const {
    recordedActions,
    replayTime,
    replaySpeed,
    status,
    setReplayTime,
    setReplaySpeed,
    stopReplay,
    totalPlayTime,
  } = useGameStore();

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentActionIndex, setCurrentActionIndex] = useState(0);
  const animationRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number>(0);
  const currentReplayTimeRef = useRef<number>(0);

  const sortedActions = [...recordedActions].sort((a, b) => a.timestamp - b.timestamp);
  const startTime = sortedActions.length > 0 ? sortedActions[0].timestamp : Date.now();
  const endTime = sortedActions.length > 0 ? sortedActions[sortedActions.length - 1].timestamp : Date.now();
  const totalDuration = Math.max(totalPlayTime, endTime - startTime);

  useEffect(() => {
    if (status === 'replaying') {
      setIsPlaying(true);
      setCurrentActionIndex(0);
      setReplayTime(0);
      currentReplayTimeRef.current = 0;
    }
  }, [status, setReplayTime]);

  useEffect(() => {
    if (status !== 'replaying') {
      setIsPlaying(false);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    const animate = (timestamp: number) => {
      if (!lastTimestampRef.current) {
        lastTimestampRef.current = timestamp;
      }

      const delta = (timestamp - lastTimestampRef.current) * replaySpeed;
      lastTimestampRef.current = timestamp;

      const newTime = currentReplayTimeRef.current + delta;
      currentReplayTimeRef.current = newTime;
      setReplayTime(newTime);

      const actionAtTime = sortedActions.find(
        (_, index) => {
          const actionTime = sortedActions[index].timestamp - startTime;
          const prevActionTime = index > 0 ? sortedActions[index - 1].timestamp - startTime : -1;
          return prevActionTime <= newTime && newTime <= actionTime;
        }
      );

      if (actionAtTime) {
        const idx = sortedActions.indexOf(actionAtTime);
        setCurrentActionIndex(idx);
      }

      if (newTime >= totalDuration) {
        setIsPlaying(false);
        return;
      }

      if (isPlaying) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    if (isPlaying) {
      lastTimestampRef.current = 0;
      animationRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, status, replaySpeed, sortedActions, startTime, totalDuration, setReplayTime]);

  const togglePlay = useCallback(() => {
    if (replayTime >= totalDuration) {
      setReplayTime(0);
      currentReplayTimeRef.current = 0;
      setCurrentActionIndex(0);
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying, replayTime, totalDuration, setReplayTime]);

  const skipBackward = useCallback(() => {
    const newIndex = Math.max(0, currentActionIndex - 1);
    setCurrentActionIndex(newIndex);
    if (sortedActions[newIndex]) {
      const newTime = sortedActions[newIndex].timestamp - startTime;
      setReplayTime(newTime);
      currentReplayTimeRef.current = newTime;
    }
  }, [currentActionIndex, sortedActions, startTime, setReplayTime]);

  const skipForward = useCallback(() => {
    const newIndex = Math.min(sortedActions.length - 1, currentActionIndex + 1);
    setCurrentActionIndex(newIndex);
    if (sortedActions[newIndex]) {
      const newTime = sortedActions[newIndex].timestamp - startTime;
      setReplayTime(newTime);
      currentReplayTimeRef.current = newTime;
    }
  }, [currentActionIndex, sortedActions, startTime, setReplayTime]);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setReplayTime(time);
    currentReplayTimeRef.current = time;

    const nearestAction = sortedActions.find(
      (action) => action.timestamp - startTime >= time
    );
    if (nearestAction) {
      setCurrentActionIndex(sortedActions.indexOf(nearestAction));
    }
  }, [sortedActions, startTime, setReplayTime]);

  const formatActionDescription = (action: ActionRecord): string => {
    const towerName = action.towerType ? TOWER_CONFIG[action.towerType]?.name || action.towerType : '';

    switch (action.type) {
      case 'build':
        return action.isValid
          ? `建造${towerName}于 (${action.position?.x}, ${action.position?.y})`
          : `尝试建造${towerName}失败：${action.remarks}`;
      case 'upgrade':
        return `升级塔于 (${action.position?.x}, ${action.position?.y})`;
      case 'sell':
        return `出售塔于 (${action.position?.x}, ${action.position?.y})`;
      case 'pause':
        return '暂停游戏';
      case 'resume':
        return '继续游戏';
      default:
        return action.remarks || '未知操作';
    }
  };

  if (status !== 'replaying') {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-slate-900/95 backdrop-blur z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden animate-slide-in">
        <div className="p-6 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
              <Gauge className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">游戏回放</h2>
              <p className="text-sm text-slate-400">
                共 {sortedActions.length} 条操作记录
              </p>
            </div>
          </div>
          <button
            onClick={stopReplay}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            <XCircle className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-slate-900/50 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-slate-300">
                <Clock className="w-4 h-4" />
                <span className="font-mono text-lg">
                  {formatTime(replayTime)}
                </span>
                <span className="text-slate-500">/</span>
                <span className="font-mono text-slate-500">
                  {formatTime(totalDuration)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-400">速度:</span>
                <select
                  value={replaySpeed}
                  onChange={(e) => setReplaySpeed(parseFloat(e.target.value))}
                  className="bg-slate-700 text-white px-3 py-1 rounded-lg text-sm border border-slate-600 focus:outline-none focus:border-blue-500"
                >
                  <option value={0.5}>0.5x</option>
                  <option value={1}>1x</option>
                  <option value={2}>2x</option>
                  <option value={4}>4x</option>
                </select>
              </div>
            </div>

            <input
              type="range"
              min={0}
              max={totalDuration}
              value={replayTime}
              onChange={handleSeek}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />

            <div className="flex items-center justify-center gap-4 mt-6">
              <button
                onClick={skipBackward}
                disabled={currentActionIndex === 0}
                className="p-3 bg-slate-700 text-white rounded-lg hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <SkipBack className="w-5 h-5" />
              </button>
              <button
                onClick={togglePlay}
                className="p-4 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-full hover:from-blue-600 hover:to-cyan-600 transition-all shadow-lg shadow-blue-500/25"
              >
                {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
              </button>
              <button
                onClick={skipForward}
                disabled={currentActionIndex >= sortedActions.length - 1}
                className="p-3 bg-slate-700 text-white rounded-lg hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <SkipForward className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="bg-slate-900/50 rounded-xl p-4 max-h-80 overflow-y-auto">
            <h3 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
              <MousePointer2 className="w-4 h-4" />
              操作时间线
            </h3>
            <div className="space-y-2">
              {sortedActions.map((action, index) => {
                const actionTime = action.timestamp - startTime;
                const isActive = index === currentActionIndex;
                const isPast = index < currentActionIndex;

                return (
                  <div
                    key={action.id}
                    className={`
                      flex items-start gap-3 p-3 rounded-lg transition-all duration-200
                      ${isActive ? 'bg-blue-500/20 border border-blue-500/50 scale-[1.02]' : ''}
                      ${isPast && !isActive ? 'opacity-60' : ''}
                      ${!isPast && !isActive ? 'bg-slate-800/50' : ''}
                    `}
                  >
                    <div
                      className={`
                        w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
                        ${action.isValid === false
                          ? 'bg-red-500/20 text-red-400'
                          : isActive
                          ? 'bg-blue-500 text-white'
                          : 'bg-slate-700 text-slate-400'}
                      `}
                    >
                      {action.towerType ? (
                        towerIcons[action.towerType]
                      ) : action.isValid === false ? (
                        <XCircle className="w-4 h-4" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`
                            text-sm font-medium
                            ${action.isValid === false
                              ? 'text-red-400'
                              : isActive
                              ? 'text-white'
                              : 'text-slate-300'}
                          `}
                        >
                          {formatActionDescription(action)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-slate-500 font-mono">
                          {formatTime(actionTime)}
                        </span>
                        {action.responseTime && (
                          <span
                            className={`
                              ${action.responseTime > 3000 ? 'text-orange-400' : 'text-slate-500'}
                            `}
                          >
                            响应: {action.responseTime}ms
                          </span>
                        )}
                        {action.isValid === false && (
                          <span className="text-red-400">违规操作</span>
                        )}
                      </div>
                      {action.remarks && action.isValid !== false && (
                        <p className="text-xs text-slate-500 mt-1">
                          备注: {action.remarks}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
