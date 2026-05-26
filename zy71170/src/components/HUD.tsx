import { Pause, Play, RotateCcw, Flag, Trash2 } from "lucide-react";
import type { Level } from "../engine/types";
import { useGameStore, computeLive } from "../store/gameStore";

export default function HUD({ level }: { level: Level }) {
  const broadcasts = useGameStore((s) => s.broadcasts);
  const phase = useGameStore((s) => s.phase);
  const setPhase = useGameStore((s) => s.setPhase);
  const reset = useGameStore((s) => s.reset);
  const finish = useGameStore((s) => s.finish);
  const previewRadius = useGameStore((s) => s.previewRadius);
  const setPreviewRadius = useGameStore((s) => s.setPreviewRadius);
  const selectedSlotId = useGameStore((s) => s.selectedSlotId);
  const adjustRadius = useGameStore((s) => s.adjustRadius);
  const removeBroadcast = useGameStore((s) => s.removeBroadcast);

  const live = computeLive(level.id, broadcasts);
  const selectedBc = broadcasts.find((b) => b.slotId === selectedSlotId);

  const score = live?.score;
  const coverage = live?.coverage;
  const complaints = live?.complaints;
  const cost = live?.cost ?? 0;

  const coveragePct = Math.round((coverage?.coverageRatio ?? 0) * 100);
  const minCoveragePct = Math.round(level.minCoverage * 100);

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-slate-300 font-mono text-xs tracking-widest">
            ● 实时态势
          </div>
          <div className="text-[11px] text-slate-500">LEVEL · {level.id.toUpperCase()}</div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <Stat
            label="覆盖率"
            value={`${coveragePct}%`}
            hint={`目标 ≥ ${minCoveragePct}%`}
            ok={(coverage?.coverageRatio ?? 0) >= level.minCoverage}
          />
          <Stat
            label="投诉"
            value={`${complaints?.count ?? 0}`}
            hint={`上限 ${level.maxComplaints}`}
            ok={(complaints?.count ?? 0) <= level.maxComplaints}
          />
          <Stat
            label="预算"
            value={`${cost}`}
            hint={`上限 ${level.budget}`}
            ok={cost <= level.budget}
          />
          <Stat
            label="设备"
            value={`${broadcasts.length}`}
            hint="台"
            ok
          />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] font-mono">
          <Mini
            label="得分"
            value={score?.score ?? 0}
            color="text-sky-300"
          />
          <Mini label="覆盖分" value={score?.coverageScore ?? 0} color="text-emerald-300" />
          <Mini
            label="扣"
            value={-(score?.complaintPenalty ?? 0) - (score?.budgetPenalty ?? 0)}
            color="text-rose-300"
          />
        </div>
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
        <div className="text-slate-300 font-mono text-xs tracking-widest mb-2">
          ● 部署控制
        </div>
        <label className="text-[11px] text-slate-400">
          新设备半径（放置前）
          <input
            type="range"
            min={60}
            max={300}
            step={5}
            value={previewRadius}
            onChange={(e) => setPreviewRadius(Number(e.target.value))}
            className="w-full accent-sky-400"
          />
          <span className="block font-mono text-sky-300">
            {previewRadius} px · 约 ¥{Math.round(level.unitCost + previewRadius * level.radiusCostPerPx)}
          </span>
        </label>

        {selectedBc && (
          <div className="mt-3 rounded border border-pink-500/40 bg-pink-500/5 p-2">
            <div className="text-[11px] text-pink-300 font-mono mb-1">
              已选中设备 {selectedBc.id.slice(-5)}
            </div>
            <label className="text-[11px] text-slate-400">
              调整半径
              <input
                type="range"
                min={60}
                max={300}
                step={5}
                value={selectedBc.radius}
                onChange={(e) => adjustRadius(selectedBc.id, Number(e.target.value))}
                className="w-full accent-pink-400"
              />
              <span className="block font-mono text-pink-300">
                {selectedBc.radius} px
              </span>
            </label>
            <button
              onClick={() => removeBroadcast(selectedBc.id)}
              className="mt-2 w-full rounded border border-rose-500/50 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs py-1 flex items-center justify-center gap-1"
            >
              <Trash2 size={12} /> 撤回设备
            </button>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
        <div className="text-slate-300 font-mono text-xs tracking-widest mb-2">
          ● 回合控制
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          {phase === "playing" ? (
            <button
              onClick={() => setPhase("paused")}
              className="rounded border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 py-2 flex items-center justify-center gap-1"
            >
              <Pause size={12} /> 暂停
            </button>
          ) : phase === "paused" ? (
            <button
              onClick={() => setPhase("playing")}
              className="rounded border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 py-2 flex items-center justify-center gap-1"
            >
              <Play size={12} /> 继续
            </button>
          ) : (
            <div className="rounded border border-slate-700 bg-slate-800/50 text-slate-500 py-2 text-center">
              未开始
            </div>
          )}
          <button
            onClick={reset}
            className="rounded border border-slate-500/40 bg-slate-500/10 hover:bg-slate-500/20 text-slate-300 py-2 flex items-center justify-center gap-1"
          >
            <RotateCcw size={12} /> 重开
          </button>
          <button
            onClick={finish}
            className="rounded border border-sky-500/40 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 py-2 flex items-center justify-center gap-1"
          >
            <Flag size={12} /> 结算
          </button>
        </div>
        <div className="mt-2 text-[11px] text-slate-500 leading-relaxed">
          左键放置/选中 · 右键或 Shift+点击 撤回 · 滚轮调节已选设备半径 · 选中后可拖动滑块调半径
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  ok,
}: {
  label: string;
  value: string;
  hint: string;
  ok: boolean;
}) {
  return (
    <div className={`rounded border ${ok ? "border-emerald-500/30 bg-emerald-500/5" : "border-rose-500/40 bg-rose-500/10"} px-2 py-1`}>
      <div className={`text-[10px] ${ok ? "text-emerald-400" : "text-rose-400"}`}>{label}</div>
      <div className={`font-mono text-lg ${ok ? "text-emerald-200" : "text-rose-200"}`}>{value}</div>
      <div className="text-[10px] text-slate-400">{hint}</div>
    </div>
  );
}

function Mini({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded border border-slate-700 bg-slate-950/50 px-2 py-1 text-center">
      <div className={`text-[10px] text-slate-400`}>{label}</div>
      <div className={`font-mono ${color}`}>{value}</div>
    </div>
  );
}
