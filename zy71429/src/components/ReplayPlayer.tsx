import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Rewind,
  FastForward,
  X,
  Clock,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { TimelineSnapshot, AuditLog, GameEvent, EVENT_LABELS } from '@/types/game';
import { cn } from '@/lib/utils';
import { diffMinutes } from '@/utils/time';

interface ReplayPlayerProps {
  isOpen: boolean;
  onClose: () => void;
}

const SPEED_OPTIONS = [0.5, 1, 2, 4];

const formatReplayTime = (date: Date): string => {
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const getDecisionNote = (snapshot: TimelineSnapshot): string | null => {
  const schedule = snapshot.state.schedules[snapshot.state.schedules.length - 1];
  if (schedule?.decisionNote) {
    return schedule.decisionNote;
  }
  return null;
};

const getProcessingLogic = (snapshot: TimelineSnapshot): string[] => {
  const logic: string[] = [];
  
  if (snapshot.events.length > 0) {
    snapshot.events.forEach((event) => {
      switch (event.type) {
        case 'schedule_created':
          logic.push('创建调度计划，锁定泊位和拖轮资源');
          logic.push('验证时间窗口是否在可操作范围内');
          logic.push('计算资源冲突和影响评估');
          break;
        case 'schedule_cancelled':
          logic.push('取消调度计划，释放锁定资源');
          logic.push('更新相关资源状态为可用');
          break;
        case 'berthing_success':
          logic.push('船舶靠泊成功，更新船舶状态为已停靠');
          logic.push('释放拖轮资源，更新泊位占用状态');
          logic.push('计算本次靠泊得分');
          break;
        case 'window_missed':
          logic.push('检测到错过靠泊窗口事件');
          logic.push('标记船舶为错过状态，记录扣分');
          break;
        case 'tug_conflict':
          logic.push('检测到拖轮资源冲突');
          logic.push('触发冲突解决机制，建议重新调度');
          break;
        case 'weather_changed':
          logic.push('天气条件变化，更新可操作窗口');
          logic.push('重新评估所有待执行计划的可行性');
          break;
        default:
          break;
      }
    });
  }
  
  if (snapshot.state.events.length > 0 && logic.length === 0) {
    logic.push('游戏时间推进，检查待执行计划');
    logic.push('更新资源状态和天气预报');
  }
  
  return logic;
};

function StateDiff({ before, after }: { before: unknown; after: unknown }) {
  const [expanded, setExpanded] = useState(true);

  const renderValue = (value: unknown, indent = 0) => {
    const indentStr = '  '.repeat(indent);
    
    if (value === null || value === undefined) {
      return <span className="text-gray-400">{indentStr}null</span>;
    }
    
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return <span className="text-blue-600">{indentStr}{String(value)}</span>;
    }
    
    if (value instanceof Date) {
      return <span className="text-purple-600">{indentStr}{formatReplayTime(value)}</span>;
    }
    
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <span className="text-gray-500">{indentStr}[]</span>;
      }
      return (
        <div>
          <span className="text-gray-500">{indentStr}[</span>
          {value.map((item, index) => (
            <div key={index}>{renderValue(item, indent + 1)}</div>
          ))}
          <span className="text-gray-500">{indentStr}]</span>
        </div>
      );
    }
    
    if (typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>);
      if (entries.length === 0) {
        return <span className="text-gray-500">{indentStr}{'{}'}</span>;
      }
      return (
        <div>
          <span className="text-gray-500">{indentStr}{'{'}</span>
          {entries.map(([key, val]) => (
            <div key={key}>
              <span className="text-gray-700">{indentStr}  {key}: </span>
              {renderValue(val, indent + 1)}
            </div>
          ))}
          <span className="text-gray-500">{indentStr}{'}'}</span>
        </div>
      );
    }
    
    return <span>{indentStr}{String(value)}</span>;
  };

  return (
    <div className="bg-gray-50 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2 flex items-center justify-between text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
      >
        <span>状态对比</span>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {expanded && (
        <div className="px-3 pb-3 grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs font-medium text-gray-500 mb-1">操作前</div>
            <div className="bg-white rounded p-2 text-xs overflow-x-auto max-h-40 overflow-y-auto font-mono">
              {renderValue(before)}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 mb-1">操作后</div>
            <div className="bg-white rounded p-2 text-xs overflow-x-auto max-h-40 overflow-y-auto font-mono">
              {renderValue(after)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReplayPlayer({ isOpen, onClose }: ReplayPlayerProps) {
  const timelineSnapshots = useGameStore((state) => state.timelineSnapshots);
  const auditLogs = useGameStore((state) => state.auditLogs);
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  
  const playIntervalRef = useRef<number | null>(null);

  const currentSnapshot = useMemo(() => {
    return timelineSnapshots[currentIndex] || null;
  }, [timelineSnapshots, currentIndex]);

  const progressPercent = useMemo(() => {
    if (timelineSnapshots.length <= 1) return 0;
    return (currentIndex / (timelineSnapshots.length - 1)) * 100;
  }, [currentIndex, timelineSnapshots.length]);

  const totalDuration = useMemo(() => {
    if (timelineSnapshots.length < 2) return 0;
    const first = timelineSnapshots[0].timestamp;
    const last = timelineSnapshots[timelineSnapshots.length - 1].timestamp;
    return diffMinutes(last, first);
  }, [timelineSnapshots]);

  const currentDuration = useMemo(() => {
    if (!currentSnapshot || timelineSnapshots.length === 0) return 0;
    const first = timelineSnapshots[0].timestamp;
    return diffMinutes(currentSnapshot.timestamp, first);
  }, [currentSnapshot, timelineSnapshots]);

  useEffect(() => {
    if (isPlaying && timelineSnapshots.length > 1) {
      const interval = 1000 / speed;
      playIntervalRef.current = window.setInterval(() => {
        setCurrentIndex((prev) => {
          if (prev >= timelineSnapshots.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, interval);
    }

    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
        playIntervalRef.current = null;
      }
    };
  }, [isPlaying, speed, timelineSnapshots.length]);

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(0);
      setIsPlaying(false);
      setSelectedLog(null);
    }
  }, [isOpen]);

  const handlePlayPause = () => {
    if (currentIndex >= timelineSnapshots.length - 1) {
      setCurrentIndex(0);
    }
    setIsPlaying(!isPlaying);
  };

  const handlePrevFrame = () => {
    setIsPlaying(false);
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNextFrame = () => {
    setIsPlaying(false);
    setCurrentIndex((prev) => Math.min(timelineSnapshots.length - 1, prev + 1));
  };

  const handleGoToStart = () => {
    setIsPlaying(false);
    setCurrentIndex(0);
  };

  const handleGoToEnd = () => {
    setIsPlaying(false);
    setCurrentIndex(timelineSnapshots.length - 1);
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (timelineSnapshots.length <= 1) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newIndex = Math.round(percent * (timelineSnapshots.length - 1));
    setCurrentIndex(Math.max(0, Math.min(timelineSnapshots.length - 1, newIndex)));
  };

  const handleProgressDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (timelineSnapshots.length <= 1) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const percent = (moveEvent.clientX - rect.left) / rect.width;
      const newIndex = Math.round(percent * (timelineSnapshots.length - 1));
      setCurrentIndex(Math.max(0, Math.min(timelineSnapshots.length - 1, newIndex)));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const snapshotAuditLogs = useMemo(() => {
    if (!currentSnapshot) return [];
    return auditLogs.filter(
      (log) => log.timestamp.getTime() <= currentSnapshot.timestamp.getTime()
    );
  }, [currentSnapshot, auditLogs]);

  const decisionNote = useMemo(() => {
    return currentSnapshot ? getDecisionNote(currentSnapshot) : null;
  }, [currentSnapshot]);

  const processingLogic = useMemo(() => {
    return currentSnapshot ? getProcessingLogic(currentSnapshot) : [];
  }, [currentSnapshot]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-800">复盘回放</h2>
            <span className="text-sm text-gray-500">
              共 {timelineSnapshots.length} 个时间点
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-600">
                  当前时间: {currentSnapshot ? formatReplayTime(currentSnapshot.timestamp) : '-'}
                </span>
              </div>
              <div className="text-sm text-gray-500">
                {currentDuration} / {totalDuration} 分钟
              </div>
            </div>

            <div
              className="relative h-3 bg-gray-200 rounded-full cursor-pointer mb-4 group"
              onClick={handleProgressClick}
              onMouseDown={handleProgressDrag}
            >
              <div
                className="absolute left-0 top-0 h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${progressPercent}%` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-white border-2 border-blue-500 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ left: `calc(${progressPercent}% - 10px)` }}
              />
            </div>

            <div className="flex items-center justify-center gap-2">
              <button
                onClick={handleGoToStart}
                disabled={timelineSnapshots.length <= 1}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Rewind className="w-5 h-5 text-gray-700" />
              </button>
              <button
                onClick={handlePrevFrame}
                disabled={currentIndex === 0 || timelineSnapshots.length <= 1}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <SkipBack className="w-5 h-5 text-gray-700" />
              </button>
              <button
                onClick={handlePlayPause}
                disabled={timelineSnapshots.length <= 1}
                className="p-3 bg-blue-600 hover:bg-blue-700 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPlaying ? (
                  <Pause className="w-6 h-6 text-white" />
                ) : (
                  <Play className="w-6 h-6 text-white ml-0.5" />
                )}
              </button>
              <button
                onClick={handleNextFrame}
                disabled={currentIndex >= timelineSnapshots.length - 1 || timelineSnapshots.length <= 1}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <SkipForward className="w-5 h-5 text-gray-700" />
              </button>
              <button
                onClick={handleGoToEnd}
                disabled={timelineSnapshots.length <= 1}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FastForward className="w-5 h-5 text-gray-700" />
              </button>

              <div className="flex items-center gap-1 ml-4 bg-gray-100 rounded-lg p-1">
                {SPEED_OPTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSpeed(s)}
                    className={cn(
                      'px-3 py-1 text-sm font-medium rounded-md transition-colors',
                      speed === s
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-800'
                    )}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-hidden grid grid-cols-2">
            <div className="overflow-y-auto p-4 border-r border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">当前事件</h3>
              {currentSnapshot && currentSnapshot.events.length > 0 ? (
                <div className="space-y-2">
                  {currentSnapshot.events.map((event: GameEvent) => (
                    <div
                      key={event.id}
                      className="p-3 bg-blue-50 border border-blue-200 rounded-lg"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                          {EVENT_LABELS[event.type]}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatReplayTime(event.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">{event.description}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-400 py-8">
                  <p>该时间点无事件</p>
                </div>
              )}

              {decisionNote && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">关键决策</h3>
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-800">{decisionNote}</p>
                  </div>
                </div>
              )}

              {processingLogic.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">处理逻辑</h3>
                  <div className="space-y-2">
                    {processingLogic.map((logic, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg"
                      >
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-green-100 text-green-700 text-xs font-medium flex items-center justify-center">
                          {index + 1}
                        </span>
                        <span className="text-sm text-gray-700">{logic}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="overflow-y-auto p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                审计日志 ({snapshotAuditLogs.length})
              </h3>
              {snapshotAuditLogs.length > 0 ? (
                <div className="space-y-2">
                  {snapshotAuditLogs.slice().reverse().map((log: AuditLog) => (
                    <div
                      key={log.id}
                      className={cn(
                        'p-3 rounded-lg border transition-colors cursor-pointer',
                        selectedLog?.id === log.id
                          ? 'bg-blue-50 border-blue-300'
                          : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                      )}
                      onClick={() => setSelectedLog(selectedLog?.id === log.id ? null : log)}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700">{log.action}</span>
                        <span className="text-xs text-gray-500">
                          {formatReplayTime(log.timestamp)}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mb-1">
                        操作人: {log.operator}
                      </div>
                      {log.reason && (
                        <p className="text-xs text-gray-600 mb-2">原因: {log.reason}</p>
                      )}
                      {selectedLog?.id === log.id && log.beforeState && log.afterState && (
                        <div className="mt-3">
                          <StateDiff before={log.beforeState} after={log.afterState} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-400 py-8">
                  <p>暂无审计日志</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
