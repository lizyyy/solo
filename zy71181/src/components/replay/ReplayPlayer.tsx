import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGameStore } from '../../store/useGameStore';
import { Game2DMap } from '../game/Game2DMap';

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export function ReplayPlayer() {
  const { replayId } = useParams<{ replayId: string }>();
  const navigate = useNavigate();
  const { getReplayList, gameState } = useGameStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const animationRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);

  const replays = getReplayList();
  const replay = replays.find((r) => r.id === replayId);

  if (!replay) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-white text-xl mb-4">未找到该回放记录</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg"
          >
            返回主菜单
          </button>
        </div>
      </div>
    );
  }

  const totalDuration = replay.endTime - replay.startTime;
  const level = useGameStore.getState().gameState;

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentTime(Number(e.target.value));
  };

  useEffect(() => {
    if (!isPlaying) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      return;
    }

    const animate = (timestamp: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = timestamp;
      }

      const delta = (timestamp - lastTimeRef.current) / 1000;
      lastTimeRef.current = timestamp;

      setCurrentTime((prev) => {
        const newTime = prev + delta;
        if (newTime >= totalDuration / 1000) {
          setIsPlaying(false);
          return totalDuration / 1000;
        }
        return newTime;
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    lastTimeRef.current = 0;
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, totalDuration]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-blue-900 to-slate-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/')}
            className="text-slate-300 hover:text-white flex items-center gap-2"
          >
            ← 返回主菜单
          </button>
          <h1 className="text-2xl font-bold text-white">回放查看</h1>
          <div className="text-slate-400">
            {replay.result === 'victory' ? '🏆 胜利' : '💔 失败'}
          </div>
        </div>

        <div className="bg-slate-800/80 rounded-2xl p-6 mb-6">
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="text-center">
              <p className="text-slate-400 text-sm">得分</p>
              <p className="text-2xl font-bold text-yellow-400">{replay.finalScore}</p>
            </div>
            <div className="text-center">
              <p className="text-slate-400 text-sm">结果</p>
              <p className={`text-2xl font-bold ${replay.result === 'victory' ? 'text-green-400' : 'text-red-400'}`}>
                {replay.result === 'victory' ? '胜利' : '失败'}
              </p>
            </div>
            <div className="text-center">
              <p className="text-slate-400 text-sm">事件数</p>
              <p className="text-2xl font-bold text-white">{replay.events.length}</p>
            </div>
            <div className="text-center">
              <p className="text-slate-400 text-sm">时长</p>
              <p className="text-2xl font-bold text-white">
                {formatTime((replay.endTime - replay.startTime) / 1000)}
              </p>
            </div>
          </div>

          <div className="bg-slate-900 rounded-xl p-4 mb-6 h-64">
            <Game2DMap />
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">
                {formatTime(currentTime)}
              </span>
              <span className="text-slate-400 text-sm">
                {formatTime(totalDuration / 1000)}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max={totalDuration / 1000}
              step="0.1"
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div className="flex justify-center gap-4">
            <button
              onClick={() => setCurrentTime(0)}
              className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg"
            >
              ⏮️ 重置
            </button>
            <button
              onClick={togglePlay}
              className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-semibold"
            >
              {isPlaying ? '⏸️ 暂停' : '▶️ 播放'}
            </button>
          </div>
        </div>

        <div className="bg-slate-800/80 rounded-2xl p-6">
          <h3 className="text-white font-semibold mb-4">关键事件</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {replay.events.map((event, index) => (
              <div
                key={index}
                className="flex items-center gap-4 p-3 bg-slate-700/50 rounded-lg"
              >
                <span className="text-slate-400 text-sm font-mono w-20">
                  {formatTime(event.timestamp)}
                </span>
                <span
                  className={`px-2 py-1 rounded text-xs ${
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
                <span className="text-slate-300 text-sm">
                  {event.type === 'rescue' && `${event.data.victimName} - +${event.data.score}分`}
                  {event.type === 'dispatch' && `巡逻员出发救援`}
                  {event.type === 'deterioration' && `${event.data.victimName}`}
                  {event.type === 'weather_change' && `天气变为${event.data.weather}`}
                  {event.type === 'victory' && `最终得分: ${event.data.score}`}
                  {event.type === 'defeat' && `${event.data.reason}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
