import { Play, Pause, SkipForward } from 'lucide-react';
import { slerp, lerp } from '@/utils/interpolation';
import { useAppStore } from '@/store/useAppStore';

interface AnimationControllerProps {
  progress: number;
  isPlaying: boolean;
  onProgressChange: (p: number) => void;
  onTogglePlay: () => void;
  onStep: () => void;
}

export default function AnimationController({
  progress,
  isPlaying,
  onProgressChange,
  onTogglePlay,
  onStep,
}: AnimationControllerProps) {
  const currentQuaternion = useAppStore((s) => s.currentQuaternion);
  const targetQuaternion = useAppStore((s) => s.targetQuaternion);
  const interpolationConfig = useAppStore((s) => s.interpolationConfig);

  const interp = interpolationConfig.method === 'slerp' ? slerp : lerp;
  const currentQ = interp(currentQuaternion, targetQuaternion, progress);

  return (
    <div
      className="rounded-lg p-3"
      style={{
        backgroundColor: 'rgba(10,14,39,0.8)',
        border: '1px solid rgba(148,163,184,0.15)',
      }}
    >
      <div className="mb-2 flex items-center gap-2">
        <button
          onClick={onTogglePlay}
          className="flex h-7 w-7 items-center justify-center rounded transition-colors hover:opacity-80"
          style={{
            backgroundColor: 'rgba(0,229,199,0.15)',
            color: '#00e5c7',
            border: '1px solid rgba(0,229,199,0.3)',
          }}
        >
          {isPlaying ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <button
          onClick={onStep}
          className="flex h-7 w-7 items-center justify-center rounded transition-colors hover:opacity-80"
          style={{
            backgroundColor: 'rgba(148,163,184,0.08)',
            color: '#94a3b8',
            border: '1px solid rgba(148,163,184,0.15)',
          }}
        >
          <SkipForward size={14} />
        </button>

        <div className="flex flex-1 items-center gap-2">
          <input
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={progress}
            onChange={(e) => onProgressChange(parseFloat(e.target.value))}
            className="h-1 flex-1 cursor-pointer appearance-none rounded-full"
            style={{
              backgroundColor: 'rgba(148,163,184,0.2)',
              accentColor: '#00e5c7',
            }}
          />
          <span className="text-[10px] font-mono text-[#94a3b8] w-12 text-right">
            {(progress * 100).toFixed(1)}%
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <span className="text-[10px] font-mono text-[#94a3b8]/50">q(t) =</span>
        <span className="text-[10px] font-mono text-[#00e5c7]">
          ({currentQ.w.toFixed(4)}, {currentQ.x.toFixed(4)}, {currentQ.y.toFixed(4)},{' '}
          {currentQ.z.toFixed(4)})
        </span>
      </div>
    </div>
  );
}
