import { useRef, useEffect, useState, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, Sun, Clock } from 'lucide-react';
import { useCurrentHour, useSandboxStore } from '../../store/useSandboxStore';
import { getHourLabel } from '../../utils/sunPosition';

export function Timeline() {
  const currentHour = useCurrentHour();
  const setCurrentHour = useSandboxStore(s => s.setCurrentHour);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  const tick = useCallback(
    (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const delta = timestamp - lastTimeRef.current;

      if (delta > 50 / playSpeed) {
        setCurrentHour(prev => {
          const next = prev + 0.1;
          return next > 24 ? 0 : next;
        });
        lastTimeRef.current = timestamp;
      }

      animationRef.current = requestAnimationFrame(tick);
    },
    [playSpeed, setCurrentHour]
  );

  useEffect(() => {
    if (isPlaying) {
      animationRef.current = requestAnimationFrame(tick);
    } else if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, tick]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentHour(parseFloat(e.target.value));
  };

  const skipBack = () => setCurrentHour(Math.max(0, currentHour - 1));
  const skipForward = () => setCurrentHour(Math.min(24, currentHour + 1));
  const togglePlay = () => setIsPlaying(!isPlaying);
  const reset = () => {
    setIsPlaying(false);
    setCurrentHour(12);
  };

  const hours = Array.from({ length: 25 }, (_, i) => i);

  return (
    <div className="h-20 bg-[#0a1628] border-t border-[#1a2a4a] flex flex-col px-6 py-2">
      <div className="flex items-center gap-4 mb-1">
        <div className="flex items-center gap-2 text-[#ffb347]">
          <Clock size={14} />
          <span className="text-xs font-medium">日照时间轴</span>
        </div>
        <div className="flex items-center gap-2 text-lg font-mono text-white">
          <Sun size={16} className="text-[#ffd93d]" />
          <span className="tabular-nums">{getHourLabel(currentHour)}</span>
        </div>

        <div className="flex items-center gap-1 ml-4">
          <button
            onClick={reset}
            className="p-1.5 text-[#8a9ab0] hover:text-white transition-colors"
            title="重置"
          >
            <SkipBack size={16} />
          </button>
          <button
            onClick={skipBack}
            className="p-1.5 text-[#8a9ab0] hover:text-white transition-colors"
            title="后退1小时"
          >
            <SkipBack size={16} />
          </button>
          <button
            onClick={togglePlay}
            className="p-1.5 bg-[#ffb347] text-[#0a1628] rounded hover:bg-[#ffc971] transition-colors"
            title={isPlaying ? '暂停' : '播放'}
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button
            onClick={skipForward}
            className="p-1.5 text-[#8a9ab0] hover:text-white transition-colors"
            title="前进1小时"
          >
            <SkipForward size={16} />
          </button>
        </div>

        <div className="flex items-center gap-2 ml-4">
          <span className="text-xs text-[#8a9ab0]">速度:</span>
          {[0.5, 1, 2, 4].map(speed => (
            <button
              key={speed}
              onClick={() => setPlaySpeed(speed)}
              className={`px-2 py-0.5 text-xs rounded transition-colors ${
                playSpeed === speed
                  ? 'bg-[#ffb347] text-[#0a1628]'
                  : 'bg-[#1a2a4a] text-[#8a9ab0] hover:text-white'
              }`}
            >
              {speed}x
            </button>
          ))}
        </div>

        <div className="flex-1" />

        <div className="text-xs text-[#5a6a80]">
          日出 06:00 | 正午 12:00 | 日落 18:00
        </div>
      </div>

      <div className="flex-1 flex items-center gap-2">
        <div className="flex-1 relative">
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-1 pointer-events-none">
            {hours.map(h => (
              <div
                key={h}
                className={`w-px h-2 ${
                  h % 6 === 0 ? 'bg-[#5a6a80] h-3' : 'bg-[#2a3a5a]'
                }`}
              />
            ))}
          </div>
          <input
            type="range"
            min={0}
            max={24}
            step={0.1}
            value={currentHour}
            onChange={handleSliderChange}
            className="w-full h-2 appearance-none bg-transparent cursor-pointer relative z-10"
            style={{
              background: `linear-gradient(to right, 
                #1a1a3a 0%, 
                #ff7e5f 20%, 
                #ffd93d 40%, 
                #fff5e6 50%, 
                #ffd93d 60%, 
                #ff7e5f 80%, 
                #1a1a3a 100%)`,
            }}
          />
          <div className="absolute inset-x-0 -bottom-4 flex justify-between px-0.5 pointer-events-none">
            {hours.filter(h => h % 3 === 0).map(h => (
              <span
                key={h}
                className="text-[10px] text-[#5a6a80] tabular-nums"
              >
                {h.toString().padStart(2, '0')}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
