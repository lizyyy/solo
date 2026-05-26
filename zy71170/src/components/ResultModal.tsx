import { Star, X, Trophy, AlertTriangle, BadgeAlert, Wallet, ChevronRight, RefreshCw, Download } from "lucide-react";
import type { Level } from "../engine/types";
import { useGameStore } from "../store/gameStore";
import { LEVELS } from "../engine/levels";

export default function ResultModal({ level, onRestart, onNext, onMenu, onExport }: {
  level: Level;
  onRestart: () => void;
  onNext: () => void;
  onMenu: () => void;
  onExport: (format: "txt" | "json") => void;
}) {
  const result = useGameStore((s) => s.result);
  if (!result?.score) return null;
  const s = result.score;
  const c = result.coverage;
  const p = result.complaints;
  const idx = LEVELS.findIndex((l) => l.id === level.id);
  const next = idx >= 0 && idx < LEVELS.length - 1 ? LEVELS[idx + 1] : undefined;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800">
          <div className="font-mono tracking-widest text-slate-400 text-xs">
            {s.success ? "◆ 任务完成" : "◆ 任务失败"}
          </div>
          <button
            onClick={onMenu}
            className="text-slate-400 hover:text-slate-200"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="text-3xl">{s.success ? "🎉" : "⚠️"}</div>
            <div>
              <div className="text-lg font-bold text-slate-100">
                {s.success ? "方案通过" : "方案不通过"}
              </div>
              <div className="text-xs text-slate-400">{level.name}</div>
            </div>
            <div className="ml-auto flex items-center gap-1">
              {[0, 1, 2].map((i) => (
                <Star
                  key={i}
                  size={22}
                  className={
                    i < s.stars
                      ? "text-amber-400 fill-amber-400"
                      : "text-slate-700"
                  }
                />
              ))}
            </div>
          </div>

          {s.failure && (
            <div className="rounded-md border border-rose-500/40 bg-rose-500/10 p-3 mb-4">
              <div className="flex items-start gap-2 text-rose-300 text-sm">
                {s.failure.type === "coverage" && <BadgeAlert size={18} />}
                {s.failure.type === "complaints" && <AlertTriangle size={18} />}
                {s.failure.type === "budget" && <Wallet size={18} />}
                <div>
                  <div className="font-bold">
                    {s.failure.type === "coverage" && "覆盖不足"}
                    {s.failure.type === "complaints" && "噪声投诉超标"}
                    {s.failure.type === "budget" && "超预算"}
                  </div>
                  <div className="text-rose-200/80 text-xs mt-1">{s.failure.reason}</div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-4 gap-2 mb-4 text-center">
            <Box label="总分" value={s.score} />
            <Box label="覆盖率" value={`${Math.round((c?.coverageRatio ?? 0) * 100)}%`} />
            <Box label="投诉" value={p?.count ?? 0} />
            <Box label="扣分" value={-(s.complaintPenalty + s.budgetPenalty)} />
          </div>

          <div className="rounded-md border border-slate-800 bg-slate-950/50 p-3 text-xs text-slate-300 mb-4 max-h-40 overflow-auto font-mono">
            <div className="text-slate-500 mb-1">● 明细</div>
            <div>覆盖得分：{s.coverageScore}</div>
            <div>投诉扣分：-{s.complaintPenalty}</div>
            <div>预算扣分：-{s.budgetPenalty}</div>
            {c && c.uncoveredBuildings.length > 0 && (
              <div className="mt-2 text-amber-300">
                未覆盖：{c.uncoveredBuildings.join("、")}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 justify-end">
            <button
              onClick={() => onExport("txt")}
              className="rounded border border-slate-600 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 text-xs flex items-center gap-1"
            >
              <Download size={12} /> 导出 TXT
            </button>
            <button
              onClick={() => onExport("json")}
              className="rounded border border-slate-600 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 text-xs flex items-center gap-1"
            >
              <Download size={12} /> 导出 JSON
            </button>
            <button
              onClick={onRestart}
              className="rounded border border-slate-600 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 text-xs flex items-center gap-1"
            >
              <RefreshCw size={12} /> 重新挑战
            </button>
            {s.success && next && (
              <button
                onClick={onNext}
                className="rounded border border-sky-500/50 bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 px-3 py-2 text-xs flex items-center gap-1"
              >
                <Trophy size={12} /> 下一关
                <ChevronRight size={12} />
              </button>
            )}
            <button
              onClick={onMenu}
              className="rounded border border-slate-600 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 text-xs"
            >
              返回菜单
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Box({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded border border-slate-800 bg-slate-950/40 py-2">
      <div className="text-[10px] text-slate-500">{label}</div>
      <div className="font-mono text-sky-300">{value}</div>
    </div>
  );
}
