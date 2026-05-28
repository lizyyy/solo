import { useEffect, useRef, useCallback } from 'react';
import { Play, Pause, SkipForward, RotateCcw, ChevronRight } from 'lucide-react';
import { useStore } from '@/store/useStore';

export default function TrajectoryPlayback() {
  const playbackState = useStore((s) => s.playbackState);
  const setPlaybackState = useStore((s) => s.setPlaybackState);
  const playbackStep = useStore((s) => s.playbackStep);
  const setPlaybackStep = useStore((s) => s.setPlaybackStep);
  const playbackSpeed = useStore((s) => s.playbackSpeed);
  const setPlaybackSpeed = useStore((s) => s.setPlaybackSpeed);
  const trajectories = useStore((s) => s.trajectories);
  const divergenceWarning = useStore((s) => s.divergenceWarning);
  const animRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const animate = useCallback(
    (time: number) => {
      if (lastTimeRef.current === 0) lastTimeRef.current = time;
      const delta = time - lastTimeRef.current;
      if (delta > 16 / playbackSpeed) {
        lastTimeRef.current = time;
        setPlaybackStep(Math.min(playbackStep + 1, trajectories.length - 1));
      }
      if (playbackStep < trajectories.length - 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        setPlaybackState('idle');
      }
    },
    [playbackStep, trajectories.length, playbackSpeed, setPlaybackStep, setPlaybackState]
  );

  useEffect(() => {
    if (playbackState === 'playing') {
      lastTimeRef.current = 0;
      animRef.current = requestAnimationFrame(animate);
    }
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [playbackState, animate]);

  const handlePlay = () => {
    if (playbackState === 'playing') {
      setPlaybackState('paused');
    } else {
      if (playbackStep >= trajectories.length - 1) {
        setPlaybackStep(0);
      }
      setPlaybackState('playing');
    }
  };

  const handleStep = () => {
    setPlaybackState('paused');
    setPlaybackStep(Math.min(playbackStep + 1, trajectories.length - 1));
  };

  const handleReset = () => {
    setPlaybackState('idle');
    setPlaybackStep(0);
  };

  const progress = trajectories.length > 1 ? (playbackStep / (trajectories.length - 1)) * 100 : 0;
  const currentPt = trajectories[playbackStep];

  return (
    <div className="bg-[#0d1b2e]/80 backdrop-blur-sm rounded-xl border border-[#1a3050]/50 p-4">
      {divergenceWarning && (
        <div className="mb-3 px-3 py-2 bg-[#FFB84D]/10 border border-[#FFB84D]/30 rounded-lg text-xs text-[#FFB84D] flex items-center gap-2"
          style={{ fontFamily: 'JetBrains Mono, monospace' }}>
          ⚠ 轨迹发散！请减小步长或调整参数
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={handleReset}
          className="w-8 h-8 flex items-center justify-center rounded-full border border-[#1a3050] bg-[#0a1628] text-[#667788] hover:text-[#FF6B4A] hover:border-[#FF6B4A]/40 transition-colors"
        >
          <RotateCcw size={14} />
        </button>

        <button
          onClick={handlePlay}
          className="w-10 h-10 flex items-center justify-center rounded-full border border-[#FF6B4A]/40 bg-[#FF6B4A]/10 text-[#FF6B4A] hover:bg-[#FF6B4A]/20 transition-colors"
        >
          {playbackState === 'playing' ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
        </button>

        <button
          onClick={handleStep}
          className="w-8 h-8 flex items-center justify-center rounded-full border border-[#1a3050] bg-[#0a1628] text-[#667788] hover:text-[#00D4AA] hover:border-[#00D4AA]/40 transition-colors"
        >
          <SkipForward size={14} />
        </button>

        <div className="flex-1 mx-2">
          <div className="w-full h-1.5 bg-[#0a1628] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-75"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(to right, #FF6B4A, #00D4AA)',
              }}
            />
          </div>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-xs text-[#667788]"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}>×</span>
          <select
            value={playbackSpeed}
            onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
            className="bg-[#0a1628] border border-[#1a3050] rounded px-1 py-0.5 text-xs text-[#aabbcc]"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          >
            <option value={0.5}>0.5</option>
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={4}>4</option>
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between mt-2 text-xs text-[#556677]"
        style={{ fontFamily: 'JetBrains Mono, monospace' }}>
        <span>步 {playbackStep}/{trajectories.length - 1}</span>
        {currentPt && (
          <span>
            t={currentPt.t.toFixed(2)} &nbsp;|&nbsp; x={currentPt.x.toFixed(2)} &nbsp; y={currentPt.y.toFixed(2)}
          </span>
        )}
      </div>
    </div>
  );
}
