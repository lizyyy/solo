import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { SEASONS } from '../data/seasons';

export function Timeline() {
  const isPlaying = useStore(state => state.isPlaying);
  const currentTime = useStore(state => state.currentTime);
  const season = useStore(state => state.season);
  
  const setIsPlaying = useStore(state => state.setIsPlaying);
  const setCurrentTime = useStore(state => state.setCurrentTime);
  const setSeason = useStore(state => state.setSeason);
  const resetState = useStore(state => state.resetState);
  
  const animationRef = useRef<number>();

  useEffect(() => {
    if (isPlaying) {
      const animate = () => {
        setCurrentTime((prev) => {
          const next = prev + 0.01;
          if (next >= 1) {
            setIsPlaying(false);
            return 0;
          }
          return next;
        });
        animationRef.current = requestAnimationFrame(animate);
      };
      animationRef.current = requestAnimationFrame(animate);
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, setIsPlaying, setCurrentTime]);

  const handleSeasonChange = (index: number) => {
    setSeason(SEASONS[index]);
  };

  const currentSeasonIndex = Math.floor(currentTime * 4) % 4;

  return (
    <div className="h-20 bg-gray-900 bg-opacity-95 border-t border-gray-700 flex items-center px-6">
      <div className="flex items-center space-x-2 mr-6">
        <button
          onClick={() => setCurrentTime(Math.max(0, currentTime - 0.1))}
          className="w-10 h-10 bg-gray-700 hover:bg-gray-600 rounded-full flex items-center justify-center text-white transition-colors"
        >
          ⏮
        </button>
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="w-12 h-12 bg-forest-600 hover:bg-forest-500 rounded-full flex items-center justify-center text-white text-xl transition-colors"
        >
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button
          onClick={() => setCurrentTime(Math.min(1, currentTime + 0.1))}
          className="w-10 h-10 bg-gray-700 hover:bg-gray-600 rounded-full flex items-center justify-center text-white transition-colors"
        >
          ⏭
        </button>
        <button
          onClick={resetState}
          className="w-10 h-10 bg-gray-700 hover:bg-gray-600 rounded-full flex items-center justify-center text-white transition-colors ml-2"
          title="重置"
        >
          🔄
        </button>
      </div>

      <div className="flex-1">
        <div className="flex items-center mb-2">
          <span className="text-white text-sm font-medium mr-4">季节时间轴</span>
          <span className="text-gray-400 text-sm">
            当前: <span style={{ color: season.color }}>{season.name}</span>
          </span>
        </div>
        <div className="relative">
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={currentTime}
            onChange={(e) => {
              const time = parseFloat(e.target.value);
              setCurrentTime(time);
              handleSeasonChange(Math.floor(time * 4) % 4);
            }}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
          />
          <div className="flex justify-between mt-1">
            {SEASONS.map((s, i) => (
              <button
                key={s.id}
                onClick={() => {
                  setCurrentTime(i / 4 + 0.1);
                  handleSeasonChange(i);
                }}
                className={`text-xs px-2 py-1 rounded transition-colors ${
                  currentSeasonIndex === i
                    ? 'bg-forest-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
                style={{ borderLeft: i > 0 ? 'none' : undefined }}
              >
                <span style={{ color: s.color }}>●</span> {s.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="ml-6 flex items-center space-x-4">
        <div className="text-right">
          <div className="text-white text-sm">视角控制</div>
          <div className="text-gray-400 text-xs">左键旋转 | 右键平移 | 滚轮缩放</div>
        </div>
      </div>
    </div>
  );
}
