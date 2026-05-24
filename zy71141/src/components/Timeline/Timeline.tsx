import React, { useEffect, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, Calendar } from 'lucide-react';
import { useInspectionStore } from '../../store/inspectionStore';

export const Timeline: React.FC = () => {
  const {
    batches,
    currentBatchId,
    setCurrentBatchId,
    isPlaying,
    setIsPlaying,
    playSpeed,
    setPlaySpeed,
    getCracksForBatch,
  } = useInspectionStore();

  const playIntervalRef = useRef<number | null>(null);

  const currentIndex = batches.findIndex((b) => b.id === currentBatchId);

  useEffect(() => {
    if (isPlaying && batches.length > 1) {
      playIntervalRef.current = window.setInterval(() => {
        const nextIndex = (currentIndex + 1) % batches.length;
        setCurrentBatchId(batches[nextIndex].id);
      }, 2000 / playSpeed);
    }

    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    };
  }, [isPlaying, currentIndex, batches, playSpeed, setCurrentBatchId]);

  const handlePlayToggle = () => {
    setIsPlaying(!isPlaying);
  };

  const handlePrevBatch = () => {
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : batches.length - 1;
    setCurrentBatchId(batches[prevIndex].id);
  };

  const handleNextBatch = () => {
    const nextIndex = (currentIndex + 1) % batches.length;
    setCurrentBatchId(batches[nextIndex].id);
  };

  const handleBatchClick = (batchId: string) => {
    setCurrentBatchId(batchId);
    if (isPlaying) {
      setIsPlaying(false);
    }
  };

  if (batches.length === 0) {
    return null;
  }

  return (
    <div className="h-24 bg-gray-900 border-t border-gray-700 flex items-center px-6">
      <div className="flex items-center gap-4 mr-8">
        <button
          onClick={handlePrevBatch}
          className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors"
          disabled={batches.length <= 1}
        >
          <SkipBack className="w-4 h-4" />
        </button>
        <button
          onClick={handlePlayToggle}
          className={`p-3 rounded-lg transition-colors ${
            isPlaying
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white'
          }`}
          disabled={batches.length <= 1}
        >
          {isPlaying ? (
            <Pause className="w-5 h-5" />
          ) : (
            <Play className="w-5 h-5 ml-0.5" />
          )}
        </button>
        <button
          onClick={handleNextBatch}
          className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors"
          disabled={batches.length <= 1}
        >
          <SkipForward className="w-4 h-4" />
        </button>

        <select
          value={playSpeed}
          onChange={(e) => setPlaySpeed(Number(e.target.value))}
          className="px-3 py-1.5 bg-gray-800 border border-gray-600 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-blue-500"
        >
          <option value={0.5}>0.5x</option>
          <option value={1}>1x</option>
          <option value={2}>2x</option>
          <option value={4}>4x</option>
        </select>
      </div>

      <div className="flex-1 relative">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium text-white">
              {batches[currentIndex]?.name}
            </span>
            <span className="text-xs text-gray-400">
              ({batches[currentIndex]?.date})
            </span>
            <span className="text-xs text-gray-500 ml-2">
              巡检员: {batches[currentIndex]?.inspector}
            </span>
          </div>
          <div className="text-xs text-gray-400">
            共 {getCracksForBatch(currentBatchId).length} 条裂缝记录
          </div>
        </div>

        <div className="relative h-8 flex items-center">
          <div className="absolute inset-x-0 h-1 bg-gray-700 rounded-full top-1/2 -translate-y-1/2" />

          {batches.map((batch, index) => {
            const isActive = batch.id === currentBatchId;
            const crackCount = getCracksForBatch(batch.id).length;

            return (
              <div
                key={batch.id}
                className="absolute top-1/2 -translate-y-1/2 cursor-pointer group"
                style={{
                  left: `${(index / (batches.length - 1)) * 100}%`,
                  transform: `translateX(-50%) translateY(-50%)`,
                }}
                onClick={() => handleBatchClick(batch.id)}
              >
                <div
                  className={`w-4 h-4 rounded-full border-2 transition-all ${
                    isActive
                      ? 'bg-blue-500 border-blue-400 scale-125 shadow-lg shadow-blue-500/50'
                      : 'bg-gray-600 border-gray-500 hover:bg-gray-500 hover:border-gray-400'
                  }`}
                />

                <div
                  className={`absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs transition-colors ${
                    isActive ? 'text-blue-400 font-medium' : 'text-gray-500 group-hover:text-gray-300'
                  }`}
                >
                  {batch.date.substring(5)}
                </div>

                <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  <div className="px-2 py-1.5 bg-gray-800 rounded text-xs text-white whitespace-nowrap shadow-lg border border-gray-600">
                    <div className="font-medium">{batch.name}</div>
                    <div className="text-gray-400">{crackCount} 条裂缝</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
