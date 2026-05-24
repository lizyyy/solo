import { Calendar, Clock, Sun, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { SOLAR_TERMS, formatTime } from '../../types';

export default function LeftControlPanel() {
  const { 
    currentDate, 
    currentTime, 
    setDate, 
    setTime, 
    isPlaying,
    playSpeed,
    setPlaySpeed,
    leftPanelOpen,
    isDataLoaded,
  } = useAppStore();

  const [dateExpanded, setDateExpanded] = useState(true);
  const [timeExpanded, setTimeExpanded] = useState(true);

  if (!leftPanelOpen || !isDataLoaded) return null;

  const handleSolarTerm = (term: typeof SOLAR_TERMS[0]) => {
    const [month, day] = term.date.split('-').map(Number);
    const newDate = new Date(currentDate.getFullYear(), month - 1, day);
    setDate(newDate);
  };

  const formatDate = (date: Date): string => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  return (
    <div className="fixed left-4 top-20 bottom-4 w-72 z-40 flex flex-col gap-3 pointer-events-none">
      <div className="glass-panel rounded-xl p-4 pointer-events-auto overflow-y-auto max-h-full">
        <div className="mb-4">
          <button
            onClick={() => setDateExpanded(!dateExpanded)}
            className="w-full flex items-center justify-between text-white font-medium text-sm"
          >
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-sun-500" />
              日期设置
            </div>
            {dateExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {dateExpanded && (
          <div className="space-y-4 mb-4">
            <div>
              <label className="block text-gray-400 text-xs mb-2">选择日期</label>
              <input
                type="date"
                value={formatDate(currentDate)}
                onChange={(e) => setDate(new Date(e.target.value))}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sun-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-gray-400 text-xs mb-2">节气快速切换</label>
              <div className="grid grid-cols-2 gap-2">
                {SOLAR_TERMS.map((term) => {
                  const [month, day] = term.date.split('-').map(Number);
                  const isActive = currentDate.getMonth() === month - 1 && currentDate.getDate() === day;
                  return (
                    <button
                      key={term.name}
                      onClick={() => handleSolarTerm(term)}
                      className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-sun-500 text-white'
                          : 'bg-white/10 text-gray-300 hover:bg-white/20'
                      }`}
                    >
                      {term.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-sun-500/10 rounded-lg p-3 border border-sun-500/30">
              <p className="text-sun-400 text-xs">
                <span className="font-medium">提示：</span>冬至日太阳高度最低，日照时长最短，是日照投诉的高发期。
              </p>
            </div>
          </div>
        )}

        <div className="border-t border-white/10 my-4" />

        <div className="mb-4">
          <button
            onClick={() => setTimeExpanded(!timeExpanded)}
            className="w-full flex items-center justify-between text-white font-medium text-sm"
          >
            <div className="flex items-center gap-2">
              <Clock size={18} className="text-sun-500" />
              时间控制
            </div>
            {timeExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {timeExpanded && (
          <div className="space-y-4">
            <div>
              <label className="block text-gray-400 text-xs mb-2">
                当前时间：<span className="text-white font-mono">{formatTime(currentTime)}</span>
              </label>
              <input
                type="range"
                min="360"
                max="1080"
                value={currentTime}
                onChange={(e) => setTime(Number(e.target.value))}
                className="w-full"
                disabled={isPlaying}
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>06:00</span>
                <span>12:00</span>
                <span>18:00</span>
              </div>
            </div>

            <div>
              <label className="block text-gray-400 text-xs mb-2">
                播放速度：{playSpeed}x
              </label>
              <input
                type="range"
                min="0.5"
                max="10"
                step="0.5"
                value={playSpeed}
                onChange={(e) => setPlaySpeed(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0.5x</span>
                <span>5x</span>
                <span>10x</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setTime(360)}
                className="flex-1 px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-xs rounded-lg transition-colors"
              >
                日出
              </button>
              <button
                onClick={() => setTime(720)}
                className="flex-1 px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-xs rounded-lg transition-colors"
              >
                正午
              </button>
              <button
                onClick={() => setTime(1080)}
                className="flex-1 px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-xs rounded-lg transition-colors"
              >
                日落
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
