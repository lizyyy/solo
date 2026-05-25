import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { Play, Pause, RotateCcw, ChevronRight, FastForward } from 'lucide-react';

function formatMin(m: number) {
  const mm = Math.floor(m);
  const ss = Math.floor((m - mm) * 60);
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function ControlPanel() {
  const state = useGameStore();
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number>(0);
  const [, force] = useState(0);

  useEffect(() => {
    const loop = (t: number) => {
      if (lastRef.current === 0) lastRef.current = t;
      const dt = t - lastRef.current;
      lastRef.current = t;
      if (state.phase === 'running') {
        state.advance(dt);
        force((x) => x + 1);
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastRef.current = 0;
    };
  }, [state]);

  const running = state.phase === 'running';
  const paused = state.phase === 'paused';

  return (
    <div className="card p-3 flex items-center gap-3">
      <div className="text-sm">
        <div className="text-[11px] text-base-400 uppercase tracking-wider">运营时间</div>
        <div className="font-mono text-lg text-accent">{formatMin(state.currentMinute)} / {formatMin(state.level?.durationMin || 0)}</div>
      </div>

      <div className="h-8 w-px bg-base-500/50" />

      {state.phase === 'ready' && (
        <button className="btn btn-primary" onClick={() => state.start()}>
          <Play size={14} /> 开始
        </button>
      )}
      {running && (
        <button className="btn btn-ghost" onClick={() => state.pause()}>
          <Pause size={14} /> 暂停
        </button>
      )}
      {paused && (
        <button className="btn btn-primary" onClick={() => state.resume()}>
          <ChevronRight size={14} /> 继续
        </button>
      )}
      {(state.phase === 'ended' || state.phase === 'replay') && (
        <button className="btn btn-ghost" onClick={() => state.reset()}>
          <RotateCcw size={14} /> 重开
        </button>
      )}

      <div className="flex items-center gap-1 ml-auto">
        <span className="text-xs text-base-400 mr-1">速度</span>
        {[1, 2, 4].map((s) => (
          <button
            key={s}
            onClick={() => state.setSpeed(s as 1 | 2 | 4)}
            className={`btn btn-sm ${state.speed === s ? 'btn-primary' : 'btn-ghost'}`}
          >
            {s === 4 ? <FastForward size={12} /> : null} {s}x
          </button>
        ))}
      </div>
    </div>
  );
}

export default ControlPanel;
