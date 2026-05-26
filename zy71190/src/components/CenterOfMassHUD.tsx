import { useGameStore } from "@/store/gameStore";
import { AlertTriangle, Gauge, Clock, Package, Target } from "lucide-react";

export function CenterOfMassHUD() {
  const level = useGameStore((s) => s.currentLevel);
  const selectedCoilId = useGameStore((s) => s.selectedCoilId);
  const currentCoilId = useGameStore((s) => s.currentCoilId);
  const coilPositions = useGameStore((s) => s.coilPositions);
  const status = useGameStore((s) => s.status);
  const timeRemaining = useGameStore((s) => s.timeRemaining);
  const movesUsed = useGameStore((s) => s.session?.movesUsed || 0);
  const maxMoves = level?.maxMoves || 0;

  if (!level) return null;

  const activeId = currentCoilId || selectedCoilId;
  const activeCoil = activeId ? level.coils.find((c) => c.id === activeId) : null;
  const activePos = activeId ? coilPositions[activeId] : null;

  const tilt = activePos?.tilt || 0;
  const tiltPct = Math.min(100, Math.abs(tilt) / level.maxTiltDegrees * 100);
  const tiltColor =
    tiltPct > 90 ? "#d9363e" : tiltPct > 60 ? "#ff8c1a" : "#16a34a";

  return (
    <div className="panel w-64 space-y-3">
      <div className="panel-title flex items-center justify-between">
        <span>状态监控</span>
        <span
          className={`text-xs px-2 py-0.5 rounded-sm ${
            status === "failed"
              ? "bg-industrial-warn/30 text-industrial-warn"
              : status === "success"
              ? "bg-industrial-ok/30 text-industrial-ok"
              : status === "paused"
              ? "bg-industrial-blue/40 text-industrial-blueLight"
              : "bg-industrial-accent/30 text-industrial-accent"
          }`}
        >
          {status.toUpperCase()}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-2 text-xs text-industrial-dim">
          <Clock size={14} />
          <span>剩余时间</span>
        </div>
        <div className="text-right font-mono text-sm">
          {Math.ceil(timeRemaining)}s
        </div>
        <div className="flex items-center gap-2 text-xs text-industrial-dim">
          <Package size={14} />
          <span>移动次数</span>
        </div>
        <div className="text-right font-mono text-sm">
          {movesUsed}/{maxMoves}
        </div>
      </div>

      <div className="h-px bg-industrial-border" />

      {activeCoil && activePos ? (
        <div className="space-y-2">
          <div className="panel-title flex items-center gap-1">
            <Gauge size={14} />
            <span>钢卷倾斜</span>
          </div>
          <div className="relative h-3 bg-industrial-bg rounded-sm overflow-hidden">
            <div
              className="absolute left-0 top-0 h-full transition-all"
              style={{
                width: `${tiltPct}%`,
                background: tiltColor,
                boxShadow: `0 0 12px ${tiltColor}`,
              }}
            />
            <div
              className="absolute top-0 h-full w-px bg-white/60"
              style={{ left: `${(level.maxTiltDegrees / (level.maxTiltDegrees * 1.5)) * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-xs font-mono">
            <span style={{ color: tiltColor }}>
              {tilt.toFixed(1)}°
            </span>
            <span className="text-industrial-dim">
              阈值 {level.maxTiltDegrees}°
            </span>
          </div>

          {Math.abs(tilt) > level.maxTiltDegrees * 0.8 && (
            <div className="flex items-center gap-2 text-industrial-warn text-xs warn-pulse p-2 rounded-sm bg-industrial-warn/10 border border-industrial-warn/30">
              <AlertTriangle size={14} />
              <span>重心偏移接近阈值，注意调整吊点</span>
            </div>
          )}
        </div>
      ) : (
        <div className="text-xs text-industrial-dim text-center py-4">
          选择钢卷开始作业
        </div>
      )}

      {activeCoil?.targetZoneId && (
        <div className="flex items-center gap-2 text-xs text-industrial-dim border-t border-industrial-border pt-2">
          <Target size={14} />
          <span>目标：{level.zones.find((z) => z.id === activeCoil.targetZoneId)?.label || activeCoil.targetZoneId}</span>
        </div>
      )}
    </div>
  );
}
