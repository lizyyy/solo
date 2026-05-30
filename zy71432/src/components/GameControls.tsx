import { useGameStore } from '../store/gameStore';
import { Play, Pause, RotateCcw, Flag, Timer } from 'lucide-react';

export const GameControls = () => {
  const {
    status,
    currentTime,
    sectorTimes,
    startGame,
    pauseGame,
    resumeGame,
    restartGame,
    finishGame,
    resetToIdle
  } = useGameStore();

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    const ms = Math.floor((time % 1) * 100);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-[#0f1c33] border border-[#1e3a5f] rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Timer className="w-5 h-5 text-[#00d4ff]" />
          <span className="text-2xl font-bold text-white font-mono tracking-wider">
            {formatTime(currentTime)}
          </span>
        </div>
        <div className="flex gap-2 text-xs">
          <div className="px-2 py-1 bg-[#00d4ff]/10 rounded text-[#00d4ff]">
            S1: {formatTime(sectorTimes[0])}
          </div>
          <div className="px-2 py-1 bg-[#ff6b35]/10 rounded text-[#ff6b35]">
            S2: {formatTime(sectorTimes[1])}
          </div>
          <div className="px-2 py-1 bg-[#4ade80]/10 rounded text-[#4ade80]">
            S3: {formatTime(sectorTimes[2])}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {status === 'idle' && (
          <button
            onClick={startGame}
            className="flex items-center justify-center gap-2 py-3 px-4 bg-green-600 hover:bg-green-500 
              text-white font-medium rounded-lg transition-all duration-200
              shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:shadow-[0_0_30px_rgba(34,197,94,0.5)]
              active:scale-95"
          >
            <Play className="w-5 h-5" />
            <span>开始</span>
          </button>
        )}

        {status === 'running' && (
          <button
            onClick={pauseGame}
            className="flex items-center justify-center gap-2 py-3 px-4 bg-yellow-600 hover:bg-yellow-500 
              text-white font-medium rounded-lg transition-all duration-200
              shadow-[0_0_20px_rgba(234,179,8,0.3)] hover:shadow-[0_0_30px_rgba(234,179,8,0.5)]
              active:scale-95"
          >
            <Pause className="w-5 h-5" />
            <span>暂停</span>
          </button>
        )}

        {status === 'paused' && (
          <button
            onClick={resumeGame}
            className="flex items-center justify-center gap-2 py-3 px-4 bg-green-600 hover:bg-green-500 
              text-white font-medium rounded-lg transition-all duration-200
              shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:shadow-[0_0_30px_rgba(34,197,94,0.5)]
              active:scale-95"
          >
            <Play className="w-5 h-5" />
            <span>继续</span>
          </button>
        )}

        {status === 'finished' && (
          <button
            onClick={resetToIdle}
            className="flex items-center justify-center gap-2 py-3 px-4 bg-green-600 hover:bg-green-500 
              text-white font-medium rounded-lg transition-all duration-200
              shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:shadow-[0_0_30px_rgba(34,197,94,0.5)]
              active:scale-95"
          >
            <Play className="w-5 h-5" />
            <span>新一局</span>
          </button>
        )}

        <button
          onClick={restartGame}
          disabled={status === 'idle'}
          className="flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 hover:bg-blue-500 
            text-white font-medium rounded-lg transition-all duration-200
            shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)]
            active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
        >
          <RotateCcw className="w-5 h-5" />
          <span>重开</span>
        </button>

        {(status === 'running' || status === 'paused') && (
          <button
            onClick={finishGame}
            className="flex items-center justify-center gap-2 py-3 px-4 bg-red-600 hover:bg-red-500 
              text-white font-medium rounded-lg transition-all duration-200
              shadow-[0_0_20px_rgba(239,68,68,0.3)] hover:shadow-[0_0_30px_rgba(239,68,68,0.5)]
              active:scale-95"
          >
            <Flag className="w-5 h-5" />
            <span>结算</span>
          </button>
        )}

        {status === 'finished' && (
          <div className="flex items-center justify-center gap-2 py-3 px-4 bg-[#1e3a5f] 
            text-[#00d4ff] font-medium rounded-lg">
            <Flag className="w-5 h-5" />
            <span>已结算</span>
          </div>
        )}

        {status === 'idle' && (
          <div className="flex items-center justify-center gap-2 py-3 px-4 bg-[#1e3a5f]/50 
            text-gray-500 font-medium rounded-lg">
            <Flag className="w-5 h-5" />
            <span>等待开始</span>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-center gap-4 text-xs text-gray-400">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500"></span>
          <span>开始</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
          <span>暂停</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-blue-500"></span>
          <span>重开</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500"></span>
          <span>结算</span>
        </div>
      </div>
    </div>
  );
};
