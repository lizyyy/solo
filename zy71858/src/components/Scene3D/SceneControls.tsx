import { Sun, Clock } from 'lucide-react';
import { useSunStore } from '@/store/useSunStore';

export function SceneControls() {
  const { sunTime, setSunTime } = useSunStore();

  const formatTime = (time: number) => {
    const hours = Math.floor(time);
    const minutes = Math.floor((time % 1) * 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  return (
    <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-10">
      <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 w-96">
        <div className="flex items-center gap-3 mb-4">
          <Sun className="w-5 h-5 text-amber-500" />
          <span className="font-semibold text-slate-700">日照时间控制</span>
          <Clock className="w-4 h-4 text-slate-400 ml-auto" />
          <span className="text-lg font-mono font-bold text-slate-800">
            {formatTime(sunTime)}
          </span>
        </div>
        
        <input
          type="range"
          min="0"
          max="24"
          step="0.25"
          value={sunTime}
          onChange={(e) => setSunTime(parseFloat(e.target.value))}
          className="w-full h-2 bg-gradient-to-r from-slate-800 via-amber-400 to-slate-800 rounded-lg appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, 
              #1e293b 0%, 
              #fbbf24 25%, 
              #fef08a 50%, 
              #fbbf24 75%, 
              #1e293b 100%)`,
          }}
        />
        
        <div className="flex justify-between mt-2 text-xs text-slate-500">
          <span>00:00</span>
          <span>06:00</span>
          <span>12:00</span>
          <span>18:00</span>
          <span>24:00</span>
        </div>

        <div className="mt-4 flex gap-2">
          {[6, 9, 12, 15, 18].map((time) => (
            <button
              key={time}
              onClick={() => setSunTime(time)}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
                sunTime === time
                  ? 'bg-primary-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {time.toString().padStart(2, '0')}:00
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
