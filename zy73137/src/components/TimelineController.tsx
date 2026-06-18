import { useEffect, useRef } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Gauge,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Wand2,
} from "lucide-react";
import { usePlaybackStore } from "@/store/usePlaybackStore";
import { ANOMALIES } from "@/data/mockData";
import { useTimeFormatter } from "@/hooks/useTimeFormatter";

export function TimelineController() {
  const {
    timeRange,
    cursor,
    playing,
    speed,
    setCursor,
    togglePlay,
    setSpeed,
    jumpToNext,
    jumpToPrev,
    anomalies,
  } = usePlaybackStore();
  const { fmtHM } = useTimeFormatter();
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number>(0);

  const [t0, t1] = timeRange;
  const pct = ((cursor - t0) / (t1 - t0)) * 100;

  useEffect(() => {
    if (!playing) return;
    lastRef.current = performance.now();
    const step = (now: number) => {
      const dt = now - lastRef.current;
      lastRef.current = now;
      const advance = (dt * speed * 60_000) / 1000;
      const next = cursor + advance;
      if (next >= t1) {
        setCursor(t1);
        togglePlay();
        return;
      }
      setCursor(next);
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, speed, t0, t1]);

  const onTrack = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const p = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setCursor(t0 + p * (t1 - t0));
  };

  return (
    <div className="glass-card px-5 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button className="btn-ghost !px-2" onClick={() => jumpToPrev()}>
            <SkipBack className="h-4 w-4" />
          </button>
          <button
            className="btn-ghost !px-2 text-ink-200"
            onClick={() => setCursor(cursor - 5 * 60000)}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            className="btn-primary !px-3"
            onClick={togglePlay}
            title={playing ? "暂停" : "播放"}
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <button
            className="btn-ghost !px-2 text-ink-200"
            onClick={() => setCursor(cursor + 5 * 60000)}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button className="btn-ghost !px-2" onClick={() => jumpToNext()}>
            <SkipForward className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-0.5">
          {([1, 2, 4] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`rounded-lg px-2 py-1 text-xs font-mono transition ${
                speed === s
                  ? "bg-ocean-600 text-white shadow"
                  : "text-ink-200 hover:text-white"
              }`}
            >
              {s}×
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <span className="chip">
            <Wand2 className="h-3 w-3 text-alert-red" />
            异常
            <span className="font-mono text-alert-red">
              {anomalies.filter((a) => a.type === "anomaly").length}
            </span>
          </span>
          <span className="chip">
            <Gauge className="h-3 w-3 text-alert-amber" />
            待确认
            <span className="font-mono text-alert-amber">
              {anomalies.filter((a) => a.type === "pending_confirmation" && !a.confirmed).length}
            </span>
          </span>
        </div>

        <div className="ml-auto font-mono text-sm text-tide-400">
          {fmtHM(cursor)}
          <span className="mx-1 text-ink-500">/</span>
          <span className="text-ink-300">
            {fmtHM(t0)} – {fmtHM(t1)}
          </span>
        </div>
      </div>

      <div className="mt-3">
        <div
          className="relative h-10 cursor-pointer rounded-xl border border-white/10 bg-gradient-to-r from-ocean-900/60 to-ocean-800/40"
          onClick={onTrack}
        >
          {/* 轨道刻度 */}
          <div className="pointer-events-none absolute inset-x-0 inset-y-0 flex items-center px-2">
            <div className="flex h-0.5 w-full items-center justify-between">
              {Array.from({ length: 13 }).map((_, i) => (
                <div key={i} className="h-1.5 w-0.5 rounded-full bg-white/20" />
              ))}
            </div>
          </div>

          {/* 已播放填充 */}
          <div
            className="pointer-events-none absolute left-0 top-0 h-full rounded-xl bg-gradient-to-r from-tide-500/30 to-tide-400/20"
            style={{ width: `${pct}%` }}
          />

          {/* 异常点标记 */}
          {ANOMALIES.map((a) => {
            const left = ((a.timestamp - t0) / (t1 - t0)) * 100;
            const color =
              a.type === "anomaly" ? "#E63946" : a.confirmed ? "#2EC4B6" : "#F4A261";
            return (
              <div
                key={a.id}
                className="absolute top-1/2 h-6 w-1.5 -translate-y-1/2 rounded-full"
                style={{ left: `calc(${left}% - 3px)`, background: color, boxShadow: `0 0 10px ${color}` }}
                title={a.reason}
              />
            );
          })}

          {/* 游标 */}
          <div
            className="absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center"
            style={{ left: `${pct}%` }}
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-tide-500 bg-ocean-900 shadow-glow">
              <div className="h-2 w-2 rounded-full bg-tide-500" />
            </div>
          </div>
        </div>

        <div className="mt-2 flex justify-between font-mono text-[10px] text-ink-300">
          {Array.from({ length: 7 }).map((_, i) => (
            <span key={i}>{fmtHM(t0 + ((t1 - t0) * i) / 6)}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
