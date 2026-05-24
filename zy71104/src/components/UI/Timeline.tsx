import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { useSceneStore } from '../../store/useSceneStore';

const Timeline = () => {
  const { 
    isPlaying, 
    liftObject, 
    setPlaying, 
    setLiftProgress,
    setCraneAngle,
    crane
  } = useSceneStore();
  
  const animationRef = useRef<gsap.core.Timeline | null>(null);
  const progressRef = useRef(liftObject.currentProgress);

  useEffect(() => {
    progressRef.current = liftObject.currentProgress;
  }, [liftObject.currentProgress]);

  useEffect(() => {
    if (isPlaying) {
      animationRef.current = gsap.timeline({
        onUpdate: () => {
          if (animationRef.current) {
            const progress = animationRef.current.progress();
            setLiftProgress(progress);
            
            const startAngle = -90;
            const endAngle = 90;
            const angle = startAngle + progress * (endAngle - startAngle);
            setCraneAngle(angle);
          }
        },
        onComplete: () => {
          setPlaying(false);
        },
      });
      
      animationRef.current.to({}, { duration: 5 });
      animationRef.current.progress(progressRef.current);
    } else {
      if (animationRef.current) {
        animationRef.current.pause();
        animationRef.current.kill();
        animationRef.current = null;
      }
    }

    return () => {
      if (animationRef.current) {
        animationRef.current.kill();
      }
    };
  }, [isPlaying, setLiftProgress, setCraneAngle, setPlaying]);

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newProgress = Number(e.target.value);
    setLiftProgress(newProgress);
    
    if (animationRef.current) {
      animationRef.current.progress(newProgress);
    }
  };

  const handlePlayPause = () => {
    setPlaying(!isPlaying);
  };

  const handleReset = () => {
    setPlaying(false);
    setLiftProgress(0);
    setCraneAngle(-90);
    progressRef.current = 0;
  };

  const handleStepForward = () => {
    setPlaying(false);
    const newProgress = Math.min(1, liftObject.currentProgress + 0.1);
    setLiftProgress(newProgress);
  };

  const handleStepBackward = () => {
    setPlaying(false);
    const newProgress = Math.max(0, liftObject.currentProgress - 0.1);
    setLiftProgress(newProgress);
  };

  const getPhaseLabel = () => {
    const progress = liftObject.currentProgress;
    if (progress <= 0.25) return '起升阶段';
    if (progress <= 0.75) return '变幅旋转';
    return '下落阶段';
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 z-20 h-20 glass-panel">
      <div className="h-full flex items-center px-4 gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={handleStepBackward}
            className="w-10 h-10 rounded-lg bg-dark-300 hover:bg-dark-400 text-white flex items-center justify-center transition-colors"
            title="后退10%"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
            </svg>
          </button>
          
          <button
            onClick={handlePlayPause}
            className="w-12 h-12 rounded-lg bg-primary hover:bg-primary/80 text-white flex items-center justify-center transition-colors"
            title={isPlaying ? '暂停' : '播放'}
          >
            {isPlaying ? (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </button>
          
          <button
            onClick={handleStepForward}
            className="w-10 h-10 rounded-lg bg-dark-300 hover:bg-dark-400 text-white flex items-center justify-center transition-colors"
            title="前进10%"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
            </svg>
          </button>
          
          <button
            onClick={handleReset}
            className="w-10 h-10 rounded-lg bg-dark-300 hover:bg-dark-400 text-white flex items-center justify-center transition-colors"
            title="重置"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-gray-400 text-xs">吊装进度</span>
            <div className="flex items-center gap-2">
              <span className="text-primary font-mono text-sm">{(liftObject.currentProgress * 100).toFixed(0)}%</span>
              <span className={`px-2 py-0.5 rounded text-xs ${
                liftObject.currentProgress <= 0.25 ? 'bg-green-500/20 text-green-400' :
                liftObject.currentProgress <= 0.75 ? 'bg-blue-500/20 text-blue-400' :
                'bg-yellow-500/20 text-yellow-400'
              }`}>
                {getPhaseLabel()}
              </span>
            </div>
          </div>
          
          <div className="relative">
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={liftObject.currentProgress}
              onChange={handleProgressChange}
              className="w-full h-2"
            />
            
            <div className="absolute top-3 left-0 right-0 flex justify-between text-xs text-gray-500 pointer-events-none">
              <span>起点</span>
              <span className="text-green-500">|</span>
              <span className="text-blue-500">|</span>
              <span>终点</span>
            </div>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-4">
          <div className="text-right">
            <div className="text-gray-400 text-xs">吊臂角度</div>
            <div className="text-white font-mono">{crane.currentAngle.toFixed(1)}°</div>
          </div>
          <div className="w-px h-8 bg-dark-400" />
          <div className="text-right">
            <div className="text-gray-400 text-xs">作业半径</div>
            <div className={`font-mono ${crane.currentRadius > crane.maxRadius ? 'text-danger' : 'text-white'}`}>
              {crane.currentRadius.toFixed(1)}m
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Timeline;
