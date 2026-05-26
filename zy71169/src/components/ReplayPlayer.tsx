import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Play, Pause, FastForward, RotateCcw, Home } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { useNavigate, useParams } from 'react-router-dom';
import type { FrameSnapshot, ErrorRecord } from '../game/types';
import { getErrorLabel } from '../game/scoring';
import { GRADE_COLORS, GRADE_NAMES } from '../game/levels';

const GRADE_MAP: Record<string, number> = {
  station_1: 1,
  station_2: 2,
  station_3: 3,
};

const STATUS_LABELS: Record<string, string> = {
  pending: '待处理',
  preparing: '备餐中',
  ready: '就绪',
  picking: '取餐中',
  completed: '已完成',
  expired: '已超时',
  failed: '失败',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-700',
  preparing: 'bg-blue-100 text-blue-700',
  ready: 'bg-amber-100 text-amber-700',
  picking: 'bg-purple-100 text-purple-700',
  completed: 'bg-emerald-100 text-emerald-700',
  expired: 'bg-rose-100 text-rose-700',
  failed: 'bg-rose-100 text-rose-700',
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  const ms = Math.floor((seconds % 1) * 10).toString();
  return `${m}:${s}.${ms}`;
}

interface CriticalEvent {
  gameTime: number;
  type: 'allergen' | 'congestion' | 'timeout';
  label: string;
}

function getCriticalEvents(errors: ErrorRecord[]): CriticalEvent[] {
  return errors
    .filter((e) => e.errorType === 'allergen_mismatch' || e.errorType === 'window_congestion' || e.errorType === 'pickup_timeout')
    .map((e) => ({
      gameTime: e.gameTime,
      type: e.errorType === 'allergen_mismatch' ? 'allergen' : e.errorType === 'window_congestion' ? 'congestion' : 'timeout',
      label: getErrorLabel(e.errorType),
    }));
}

const EVENT_COLORS: Record<string, string> = {
  allergen: 'bg-rose-500',
  congestion: 'bg-amber-500',
  timeout: 'bg-purple-500',
};

export default function ReplayPlayer() {
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();

  const frameSnapshots = useGameStore((s) => s.frameSnapshots);
  const getSession = useGameStore((s) => s.getSession);
  const resetGame = useGameStore((s) => s.resetGame);

  const session = sessionId ? getSession(sessionId) : null;

  const frames: FrameSnapshot[] = frameSnapshots;
  const criticalEvents = useMemo(() => getCriticalEvents(session?.errors ?? []), [session]);

  const totalDuration = frames.length > 0 ? frames[frames.length - 1].gameTime : 1;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    setCurrentIndex(0);
    setIsPlaying(false);
  }, [sessionId]);

  useEffect(() => {
    if (!isPlaying) {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = window.setInterval(() => {
      setCurrentIndex((prev) => {
        if (prev >= frames.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1000 / (speed * 10));

    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPlaying, speed, frames.length]);

  const currentFrame = frames[currentIndex];

  const togglePlay = () => {
    if (frames.length === 0) return;
    if (currentIndex >= frames.length - 1) {
      setCurrentIndex(0);
    }
    setIsPlaying((p) => !p);
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentIndex(0);
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setCurrentIndex(val);
  };

  const handleHome = () => {
    resetGame();
    navigate('/');
  };

  const progressPercent = totalDuration > 0 && currentFrame ? (currentFrame.gameTime / totalDuration) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="flex items-center justify-between rounded-xl bg-slate-800/80 p-4 shadow-lg backdrop-blur">
          <div>
            <h1 className="text-xl font-bold">历史回放</h1>
            <p className="text-xs text-slate-400">{session?.levelName ?? sessionId ?? '未命名会话'}</p>
          </div>
          <button
            onClick={handleHome}
            className="flex items-center gap-2 rounded-lg bg-slate-700 px-4 py-2 text-sm transition hover:bg-slate-600"
          >
            <Home className="h-4 w-4" />
            <span>主菜单</span>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <div className="lg:col-span-3 space-y-4">
            <div className="rounded-2xl bg-slate-800/80 p-6 shadow-lg backdrop-blur">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-300">3D 场景</h2>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span className="font-mono">{currentFrame ? formatTime(currentFrame.gameTime) : '00:00.0'}</span>
                  <span>/ {formatTime(totalDuration)}</span>
                </div>
              </div>

              <div className="relative h-80 rounded-xl bg-gradient-to-b from-slate-700 to-slate-900 p-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-xs text-slate-400">备餐台</p>
                    <div className="flex w-full flex-col gap-2">
                      {(currentFrame?.prepStations ?? []).map((station) => {
                        const grade = GRADE_MAP[station.id] ?? 1;
                        return (
                          <div
                            key={station.id}
                            className="flex h-16 items-center justify-center rounded-lg shadow-md"
                            style={{ backgroundColor: GRADE_COLORS[grade] }}
                          >
                            <div className="text-center">
                              <p className="text-sm font-bold text-white">{GRADE_NAMES[grade]}</p>
                              <p className="text-xs text-white/80">{station.meals.length} 份</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-2">
                    <p className="text-xs text-slate-400">订单流</p>
                    <div className="flex w-full flex-1 flex-col gap-1 overflow-y-auto">
                      {(currentFrame?.orders ?? []).slice(0, 8).map((o) => (
                        <div
                          key={o.id}
                          className={`flex items-center justify-between rounded px-2 py-1 text-xs ${STATUS_COLORS[o.status] ?? 'bg-slate-200 text-slate-700'}`}
                        >
                          <span className="truncate">{o.studentName}</span>
                          <span className="truncate">{o.mealName}</span>
                        </div>
                      ))}
                      {(currentFrame?.orders.length ?? 0) > 8 && (
                        <p className="text-center text-xs text-slate-500">...还有 {currentFrame!.orders.length - 8} 条</p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-2">
                    <p className="text-xs text-slate-400">取餐窗口</p>
                    <div className="flex w-full flex-col gap-2">
                      {(currentFrame?.pickupWindows ?? []).map((w, idx) => (
                        <div key={w.id} className="rounded-lg bg-slate-700 p-2 shadow">
                          <p className="text-xs font-semibold text-slate-200">窗口 {idx + 1}</p>
                          <p className="text-xs text-slate-400">队列: {w.queue.length}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-800/80 p-6 shadow-lg backdrop-blur">
              <div className="mb-4 flex items-center gap-2">
                <p className="text-sm font-semibold text-slate-300">时间轴</p>
              </div>
              <div className="relative mb-4">
                <div className="relative h-2 w-full rounded-full bg-slate-700">
                  <div
                    className="absolute left-0 top-0 h-full rounded-full bg-indigo-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                  {criticalEvents.map((evt, idx) => (
                    <div
                      key={idx}
                      className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ${EVENT_COLORS[evt.type]}`}
                      style={{ left: `${(evt.gameTime / totalDuration) * 100}%` }}
                      title={`${formatTime(evt.gameTime)} - ${evt.label}`}
                    />
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-4 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-rose-500" />过敏
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-amber-500" />拥堵
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-purple-500" />超时
                  </span>
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={Math.max(0, frames.length - 1)}
                value={currentIndex}
                onChange={handleProgressChange}
                className="w-full accent-indigo-500"
                disabled={frames.length === 0}
              />
            </div>

            <div className="rounded-2xl bg-slate-800/80 p-4 shadow-lg backdrop-blur">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={togglePlay}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-white transition hover:bg-indigo-700"
                    disabled={frames.length === 0}
                  >
                    {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                  </button>
                  <button
                    onClick={handleReset}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-700 text-white transition hover:bg-slate-600"
                  >
                    <RotateCcw className="h-5 w-5" />
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  {[0.5, 1, 2].map((s) => (
                    <button
                      key={s}
                      onClick={() => setSpeed(s)}
                      className={`flex h-8 w-12 items-center justify-center rounded-lg text-xs font-medium transition ${
                        speed === s ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                  <FastForward className="ml-2 h-4 w-4 text-slate-500" />
                </div>

                <div className="text-xs text-slate-400">
                  帧 {currentIndex + 1} / {frames.length}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl bg-slate-800/80 p-6 shadow-lg backdrop-blur">
              <h2 className="mb-4 text-sm font-semibold text-slate-300">当前帧信息</h2>
              {currentFrame ? (
                <div className="space-y-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">时间</span>
                    <span className="font-mono text-slate-100">{formatTime(currentFrame.gameTime)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">得分</span>
                    <span className="font-bold text-emerald-400">{currentFrame.score}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">连击</span>
                    <span className="font-bold text-amber-400">{currentFrame.combo}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">订单总数</span>
                    <span className="text-slate-100">{currentFrame.orders.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">进行中</span>
                    <span className="text-slate-100">
                      {currentFrame.orders.filter((o) => o.status === 'preparing' || o.status === 'picking').length}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">暂无帧数据</p>
              )}
            </div>

            <div className="rounded-2xl bg-slate-800/80 p-6 shadow-lg backdrop-blur">
              <h2 className="mb-4 text-sm font-semibold text-slate-300">订单状态</h2>
              <div className="max-h-64 space-y-1 overflow-y-auto text-xs">
                {(currentFrame?.orders ?? []).map((o) => (
                  <div key={o.id} className="flex items-center justify-between border-b border-slate-700/50 py-1">
                    <div>
                      <p className="text-slate-200">{o.studentName}</p>
                      <p className="text-slate-500">{o.mealName}</p>
                    </div>
                    <span className={`rounded px-2 py-0.5 text-[10px] ${STATUS_COLORS[o.status] ?? 'bg-slate-600 text-slate-100'}`}>
                      {STATUS_LABELS[o.status] ?? o.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
