import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGameStore } from '../../store/useGameStore';
import { Game2DMap } from '../game/Game2DMap';
import { getLevelById } from '../../game/data/levels';
import { GameState, GameStatus } from '../../game/types';

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const findSnapshotForTime = (
  snapshots: Array<{ time: number; state: Partial<GameState> }>,
  time: number
) => {
  if (snapshots.length === 0) return null;
  if (time <= snapshots[0].time) return snapshots[0];
  if (time >= snapshots[snapshots.length - 1].time) return snapshots[snapshots.length - 1];
  
  for (let i = 1; i < snapshots.length; i++) {
    if (snapshots[i].time >= time) {
      const prev = snapshots[i - 1];
      const next = snapshots[i];
      const ratio = (time - prev.time) / (next.time - prev.time);
      return {
        time,
        state: {
          timeElapsed: time,
          score: Math.round(prev.state.score! + (next.state.score! - prev.state.score!) * ratio),
          weather: prev.state.weather,
          victims: prev.state.victims,
          patrollers: prev.state.patrollers,
        },
      };
    }
  }
  return snapshots[snapshots.length - 1];
};

export function ReplayPlayer() {
  const { replayId } = useParams<{ replayId: string }>();
  const navigate = useNavigate();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [replayState, setReplayState] = useState<GameState | null>(null);
  const animationRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);
  const getReplayList = useGameStore((state) => state.getReplayList);
  const replays = useMemo(() => getReplayList(), [getReplayList]);
  const replay = replays.find((r) => r.id === replayId);

  useEffect(() => {
    if (!replay) return;
    
    const level = getLevelById(replay.levelId);
    if (!level) return;

    const initialState: GameState = {
      status: 'playing' as GameStatus,
      currentLevelId: replay.levelId,
      timeElapsed: 0,
      timeLimit: level.timeLimit,
      score: 0,
      weather: level.initialWeather,
      weatherEndTime: 0,
      slopes: JSON.parse(JSON.stringify(level.slopes)),
      victims: JSON.parse(JSON.stringify(level.victims)),
      patrollers: JSON.parse(JSON.stringify(level.patrollers)),
      selectedEquipment: [],
      dispatchHistory: [],
      keyEvents: replay.events,
    };
    setReplayState(initialState);
    setCurrentTime(0);
    setIsPlaying(false);
  }, [replay]);

  useEffect(() => {
    if (!replay || !replayState || !isPlaying) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      return;
    }

    const totalDuration = (replay.endTime - replay.startTime) / 1000;

    const animate = (timestamp: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = timestamp;
      }

      const delta = (timestamp - lastTimeRef.current) / 1000;
      lastTimeRef.current = timestamp;

      setCurrentTime((prev) => {
        const newTime = prev + delta;
        if (newTime >= totalDuration) {
          setIsPlaying(false);
          return totalDuration;
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
  }, [isPlaying, replay, replayState]);

  useEffect(() => {
    if (!replay || !replayState) return;

    const snapshot = findSnapshotForTime(replay.stateSnapshots || [], currentTime);
    if (snapshot) {
      setReplayState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          timeElapsed: snapshot.state.timeElapsed ?? prev.timeElapsed,
          score: snapshot.state.score ?? prev.score,
          weather: snapshot.state.weather ?? prev.weather,
          victims: snapshot.state.victims ?? prev.victims,
          patrollers: snapshot.state.patrollers ?? prev.patrollers,
        };
      });
    }
  }, [currentTime, replay, replayState]);

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentTime(Number(e.target.value));
  };

  const handleReset = () => {
    setCurrentTime(0);
    setIsPlaying(false);
  };

  if (!replay || !replayState) {
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

  const totalDuration = (replay.endTime - replay.startTime) / 1000;

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
              <p className="text-slate-400 text-sm">当前得分</p>
              <p className="text-2xl font-bold text-yellow-400">{replayState.score}</p>
            </div>
            <div className="text-center">
              <p className="text-slate-400 text-sm">最终得分</p>
              <p className="text-2xl font-bold text-yellow-400">{replay.finalScore}</p>
            </div>
            <div className="text-center">
              <p className="text-slate-400 text-sm">当前天气</p>
              <p className="text-xl font-bold text-blue-400">{replayState.weather}</p>
            </div>
            <div className="text-center">
              <p className="text-slate-400 text-sm">结果</p>
              <p className={`text-2xl font-bold ${replay.result === 'victory' ? 'text-green-400' : 'text-red-400'}`}>
                {replay.result === 'victory' ? '胜利' : '失败'}
              </p>
            </div>
          </div>

          <div className="bg-slate-900 rounded-xl p-4 mb-6 h-64">
            <ReplayMapWrapper gameState={replayState} />
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">
                {formatTime(currentTime)}
              </span>
              <span className="text-slate-400 text-sm">
                {formatTime(totalDuration)}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max={totalDuration}
              step="0.1"
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div className="flex justify-center gap-4">
            <button
              onClick={handleReset}
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
                className={`flex items-center gap-4 p-3 rounded-lg transition-all ${
                  currentTime >= event.timestamp
                    ? 'bg-slate-700/50 opacity-100'
                    : 'bg-slate-700/20 opacity-50'
                }`}
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
                      : event.type === 'warning'
                      ? 'bg-amber-600 text-white'
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
                    : event.type === 'warning'
                    ? '警告'
                    : '失败'}
                </span>
                <span className="text-slate-300 text-sm">
                  {event.type === 'rescue' && `${event.data.victimName} - +${event.data.score}分`}
                  {event.type === 'dispatch' && `巡逻员出发救援`}
                  {event.type === 'deterioration' && `${event.data.victimName}`}
                  {event.type === 'weather_change' && `天气变为${event.data.weather}`}
                  {event.type === 'victory' && `最终得分: ${event.data.score}`}
                  {event.type === 'defeat' && `${event.data.reason}`}
                  {event.type === 'warning' && `${event.data.message}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReplayMapWrapper({ gameState }: { gameState: GameState }) {
  const originalGameState = useGameStore((state) => state.gameState);
  
  useEffect(() => {
    return () => {
      useGameStore.setState({ gameState: originalGameState });
    };
  }, [originalGameState]);

  useEffect(() => {
    useGameStore.setState({ gameState });
  }, [gameState]);

  return <Game2DMap />;
}
