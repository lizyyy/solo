import { useRef, useEffect, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, Gauge } from 'lucide-react';
import { useSwingStore } from '@/store/useSwingStore';
import { Keyframe, Anomaly } from '@/types';

export function Timeline() {
  const { 
    currentSession, 
    selectedFrameIndex, 
    isPlaying, 
    playbackSpeed,
    setSelectedFrame,
    setPlaying,
    setPlaybackSpeed,
    flyToFrame,
  } = useSwingStore();
  
  const progressRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  
  const totalFrames = currentSession?.frames.length || 0;
  const progress = totalFrames > 0 ? (selectedFrameIndex / (totalFrames - 1)) * 100 : 0;
  
  const animate = useCallback(() => {
    if (!currentSession) return;
    
    setSelectedFrame(prev => {
      const next = prev + playbackSpeed;
      if (next >= currentSession.frames.length - 1) {
        setPlaying(false);
        return currentSession.frames.length - 1;
      }
      return Math.floor(next);
    });
    
    animationRef.current = requestAnimationFrame(animate);
  }, [currentSession, playbackSpeed, setSelectedFrame, setPlaying]);
  
  useEffect(() => {
    if (isPlaying) {
      animationRef.current = requestAnimationFrame(animate);
    } else if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, animate]);
  
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !currentSession) return;
    
    const rect = progressRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const frameIndex = Math.floor(percentage * (currentSession.frames.length - 1));
    
    setSelectedFrame(frameIndex);
    flyToFrame(frameIndex);
  };
  
  const handleKeyframeClick = (e: React.MouseEvent, keyframe: Keyframe) => {
    e.stopPropagation();
    if (!currentSession) return;
    const frameIndex = currentSession.frames.findIndex(f => f.frameId === keyframe.frameId);
    if (frameIndex >= 0) {
      setSelectedFrame(frameIndex);
      flyToFrame(frameIndex);
    }
  };
  
  const handleAnomalyClick = (e: React.MouseEvent, anomaly: Anomaly) => {
    e.stopPropagation();
    if (!currentSession) return;
    if (anomaly.frameRange) {
      const frameIndex = anomaly.frameRange.start;
      setSelectedFrame(frameIndex);
      flyToFrame(frameIndex);
    } else if (anomaly.frameId) {
      const frameIndex = currentSession.frames.findIndex(f => f.frameId === anomaly.frameId);
      if (frameIndex >= 0) {
        setSelectedFrame(frameIndex);
        flyToFrame(frameIndex);
      }
    }
  };
  
  if (!currentSession) return null;
  
  const keyframes = currentSession.keyframes;
  const anomalies = currentSession.anomalies;
  
  const getAnomalyPosition = (anomaly: Anomaly): number => {
    if (!currentSession) return 0;
    if (anomaly.frameRange) {
      return (anomaly.frameRange.start / (currentSession.frames.length - 1)) * 100;
    }
    if (anomaly.frameId) {
      const idx = currentSession.frames.findIndex(f => f.frameId === anomaly.frameId);
      return (idx / (currentSession.frames.length - 1)) * 100;
    }
    return 0;
  };
  
  return (
    <div className="bg-golf-bg-light border-t border-golf-border px-6 py-3">
      <div className="flex items-center gap-4 mb-3">
        <button
          onClick={() => {
            setSelectedFrame(0);
            flyToFrame(0);
          }}
          className="p-2 rounded-md text-golf-text-muted hover:text-golf-text hover:bg-golf-bg-lighter transition-colors"
        >
          <SkipBack className="w-4 h-4" />
        </button>
        
        <button
          onClick={() => setPlaying(!isPlaying)}
          className="p-3 rounded-full bg-golf-green text-golf-bg hover:shadow-neon-green transition-all"
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
        </button>
        
        <button
          onClick={() => {
            setSelectedFrame(currentSession.frames.length - 1);
            flyToFrame(currentSession.frames.length - 1);
          }}
          className="p-2 rounded-md text-golf-text-muted hover:text-golf-text hover:bg-golf-bg-lighter transition-colors"
        >
          <SkipForward className="w-4 h-4" />
        </button>
        
        <div className="flex items-center gap-2 ml-4">
          <Gauge className="w-4 h-4 text-golf-text-muted" />
          <select
            value={playbackSpeed}
            onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
            className="bg-golf-bg border border-golf-border rounded px-2 py-1 text-sm text-golf-text font-mono focus:outline-none focus:border-golf-blue"
          >
            <option value={0.25}>0.25x</option>
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={4}>4x</option>
          </select>
        </div>
        
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-golf-text-muted font-mono">
            {currentSession.studentName}
          </span>
          <span className="text-xs text-golf-text-dim font-mono">
            {selectedFrameIndex} / {totalFrames - 1}
          </span>
        </div>
      </div>
      
      <div 
        ref={progressRef}
        onClick={handleProgressClick}
        className="relative h-16 bg-golf-bg rounded-lg cursor-pointer overflow-hidden group"
      >
        <div className="absolute inset-0 flex items-center px-4">
          <div className="w-full h-2 bg-golf-border rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-golf-green to-golf-blue transition-all duration-75"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        
        {keyframes.map(keyframe => {
          const frameIndex = currentSession.frames.findIndex(f => f.frameId === keyframe.frameId);
          if (frameIndex < 0) return null;
          const pos = (frameIndex / (currentSession.frames.length - 1)) * 100;
          
          return (
            <div
              key={keyframe.keyframeId}
              onClick={(e) => handleKeyframeClick(e, keyframe)}
              className="absolute top-1/2 -translate-y-1/2 cursor-pointer group/keyframe"
              style={{ left: `calc(${pos}% - 8px)` }}
            >
              <div 
                className="w-4 h-4 rounded-full border-2 border-golf-bg shadow-lg transition-transform hover:scale-125"
                style={{ backgroundColor: keyframe.color }}
              />
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-golf-bg-light border border-golf-border rounded px-2 py-1 text-xs text-golf-text whitespace-nowrap opacity-0 group-hover/keyframe:opacity-100 transition-opacity pointer-events-none z-10">
                {keyframe.label}
              </div>
            </div>
          );
        })}
        
        {anomalies.map(anomaly => {
          const pos = getAnomalyPosition(anomaly);
          const color = anomaly.severity === 'high' ? 'bg-golf-red' : 'bg-golf-orange';
          
          return (
            <div
              key={anomaly.anomalyId}
              onClick={(e) => handleAnomalyClick(e, anomaly)}
              className="absolute bottom-2 cursor-pointer group/anomaly"
              style={{ left: `calc(${pos}% - 6px)` }}
            >
              <div className={`w-3 h-3 ${color} rotate-45 animate-pulse shadow-lg`} />
              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-golf-red/90 border border-golf-red rounded px-2 py-1 text-xs text-white whitespace-nowrap opacity-0 group-hover/anomaly:opacity-100 transition-opacity pointer-events-none z-10">
                {anomaly.type === 'jitter' ? '坐标抖动' : 
                 anomaly.type === 'faceAngleReverse' ? '杆面角反向' :
                 anomaly.type === 'impactPointMissing' ? '击球点丢失' : '数据断层'}
              </div>
            </div>
          );
        })}
        
        {currentSession.frames.filter(f => f.isSupplemented).map((frame, idx) => {
          const frameIndex = currentSession.frames.findIndex(f => f.frameId === frame.frameId);
          if (frameIndex < 0) return null;
          const pos = (frameIndex / (currentSession.frames.length - 1)) * 100;
          
          return (
            <div
              key={`supp-${idx}`}
              className="absolute top-2"
              style={{ left: `calc(${pos}% - 4px)` }}
            >
              <div className="w-2 h-2 bg-golf-orange rounded-full" />
            </div>
          );
        })}
        
        <div 
          className="absolute top-0 bottom-0 w-0.5 bg-golf-blue shadow-neon-blue pointer-events-none"
          style={{ left: `${progress}%` }}
        />
      </div>
    </div>
  );
}
