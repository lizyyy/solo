import React from 'react';
import { Play, Pause, SkipBack, SkipForward, Gauge } from 'lucide-react';
import { useSimulationStore } from '@/store/simulationStore';

const Timeline: React.FC = () => {
  const isPlaying = useSimulationStore(state => state.isPlaying);
  const setPlaying = useSimulationStore(state => state.setPlaying);
  const currentTime = useSimulationStore(state => state.currentTime);
  const speed = useSimulationStore(state => state.speed);
  const setSpeed = useSimulationStore(state => state.setSpeed);
  const resetSimulation = useSimulationStore(state => state.resetSimulation);
  const statistics = useSimulationStore(state => state.statistics);
  
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  const progress = statistics.totalStudents > 0 
    ? (statistics.evacuatedStudents / statistics.totalStudents) * 100 
    : 0;
  
  return (
    <div className="absolute bottom-0 left-0 right-0 h-20 bg-slate-900/90 backdrop-blur-sm border-t border-slate-700 flex items-center px-6 gap-6 z-10">
      <div className="flex items-center gap-2">
        <button
          onClick={resetSimulation}
          className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors"
        >
          <SkipBack className="w-5 h-5" />
        </button>
        
        <button
          onClick={() => setPlaying(!isPlaying)}
          className={`p-3 rounded-lg transition-colors ${
            isPlaying 
              ? 'bg-orange-600 hover:bg-orange-700 text-white' 
              : 'bg-green-600 hover:bg-green-700 text-white'
          }`}
        >
          {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
        </button>
        
        <button
          className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors opacity-50 cursor-not-allowed"
          disabled
        >
          <SkipForward className="w-5 h-5" />
        </button>
      </div>
      
      <div className="flex-1">
        <div className="flex justify-between text-sm text-slate-400 mb-2">
          <span>疏散进度</span>
          <span>{statistics.evacuatedStudents}/{statistics.totalStudents} 人 ({progress.toFixed(1)}%)</span>
        </div>
        
        <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-green-600 to-green-400 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        
        <div className="flex justify-between text-xs text-slate-500 mt-1">
          <span>当前时间: {formatTime(currentTime)}</span>
          <span>预计完成: {statistics.maxEvacuationTime > 0 ? formatTime(statistics.maxEvacuationTime) : '--:--'}</span>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Gauge className="w-5 h-5 text-slate-400" />
          <span className="text-sm text-slate-400">速度:</span>
        </div>
        
        <div className="flex items-center gap-1">
          {[0.5, 1, 2, 4].map(s => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                speed === s 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Timeline;
