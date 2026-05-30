import { useState } from 'react';
import { NavBar } from '@/components/ui/NavBar';
import { Play, Pause, SkipBack, SkipForward, RotateCcw, Clock, Info } from 'lucide-react';
import { useYardStore } from '@/store/useYardStore';

export default function ReplayPage() {
  const { timelineEvents, currentTime, setCurrentTime } = useYardStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  const startTime = new Date(Date.now() - 4 * 3600 * 1000);
  const endTime = new Date(Date.now() + 8 * 3600 * 1000);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateTime = (date: Date) => {
    return new Date(date).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getProgress = () => {
    const total = endTime.getTime() - startTime.getTime();
    const current = currentTime.getTime() - startTime.getTime();
    return (current / total) * 100;
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = new Date(startTime.getTime() + percentage * (endTime.getTime() - startTime.getTime()));
    setCurrentTime(newTime);
  };

  const getEventPosition = (eventTime: Date) => {
    const total = endTime.getTime() - startTime.getTime();
    const eventPos = new Date(eventTime).getTime() - startTime.getTime();
    return (eventPos / total) * 100;
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'crane_start':
      case 'crane_end':
        return '🏗️';
      case 'truck_arrival':
      case 'truck_departure':
        return '🚛';
      case 'conflict':
        return '⚠️';
      case 'resolution':
        return '✅';
      default:
        return '📌';
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-950">
      <NavBar />
      <div className="pl-14 h-full flex flex-col">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-white mb-2">任务回放</h1>
          <p className="text-slate-400 text-sm">查看历史作业记录，追溯冲突发生过程</p>
        </div>

        <div className="flex-1 px-6 pb-6 overflow-y-auto">
          <div className="bg-slate-900/50 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setCurrentTime(startTime)}
                  className="p-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  <SkipBack className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                </button>
                <button
                  onClick={() => setCurrentTime(endTime)}
                  className="p-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  <SkipForward className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setCurrentTime(new Date())}
                  className="p-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  <RotateCcw className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-sm">速度:</span>
                {[0.5, 1, 2, 4].map((speed) => (
                  <button
                    key={speed}
                    onClick={() => setPlaybackSpeed(speed)}
                    className={`px-3 py-1 text-sm rounded transition-colors ${
                      playbackSpeed === speed
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 bg-slate-800 px-4 py-2 rounded-lg">
                <Clock className="w-4 h-4 text-slate-400" />
                <span className="text-white font-mono">{formatDateTime(currentTime)}</span>
              </div>
            </div>

            <div className="relative h-16 bg-slate-800 rounded-lg cursor-pointer" onClick={handleTimelineClick}>
              <div
                className="absolute top-0 left-0 h-full bg-blue-600/20 rounded-l"
                style={{ width: `${getProgress()}%` }}
              />

              {timelineEvents.map((event) => {
                const pos = getEventPosition(event.timestamp);
                if (pos < 0 || pos > 100) return null;
                return (
                  <div
                    key={event.id}
                    className="absolute top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-lg cursor-pointer hover:scale-125 transition-transform"
                    style={{ left: `calc(${pos}% - 16px)` }}
                    title={event.title}
                  >
                    {getEventIcon(event.type)}
                  </div>
                );
              })}

              <div
                className="absolute top-0 w-0.5 h-full bg-white shadow-lg shadow-white/30"
                style={{ left: `${getProgress()}%` }}
              />

              <div className="absolute bottom-1 left-0 right-0 flex justify-between px-4 text-xs text-slate-500">
                <span>{formatTime(startTime)}</span>
                <span>{formatTime(new Date())}</span>
                <span>{formatTime(endTime)}</span>
              </div>
            </div>

            <div className="flex items-center gap-6 mt-4">
              <div className="flex items-center gap-2">
                <span className="text-lg">🏗️</span>
                <span className="text-xs text-slate-400">吊机作业</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg">🚛</span>
                <span className="text-xs text-slate-400">卡车活动</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg">⚠️</span>
                <span className="text-xs text-slate-400">冲突事件</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg">✅</span>
                <span className="text-xs text-slate-400">问题解决</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/50 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">事件列表</h2>
              <div className="flex items-center gap-1 text-xs text-slate-400">
                <Info className="w-3.5 h-3.5" />
                点击时间轴上的图标可快速定位
              </div>
            </div>

            <div className="space-y-3">
              {timelineEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-start gap-4 p-3 bg-slate-800/50 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                  onClick={() => setCurrentTime(new Date(event.timestamp))}
                >
                  <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center text-xl">
                    {getEventIcon(event.type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-white font-medium">{event.title}</h3>
                      <span className="text-xs text-slate-400">
                        {formatDateTime(event.timestamp)}
                      </span>
                    </div>
                    <p className="text-slate-400 text-sm mt-1">{event.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
