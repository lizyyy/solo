import { useGameStore } from "@/store/useGameStore";
import { AlertTriangle, CheckCircle2, Download, RotateCcw, Home, Play, X } from "lucide-react";
import { downloadReportJSON, downloadReportText, reportToText } from "@/utils/report";
import { LEVELS } from "@/data/levels";
import { useNavigate } from "react-router-dom";

export default function ResultModal() {
  const status = useGameStore((s) => s.status);
  const report = useGameStore((s) => s.report);
  const failReason = useGameStore((s) => s.failReason);
  const levelId = useGameStore((s) => s.levelId);
  const resetLevel = useGameStore((s) => s.resetLevel);
  const clear = useGameStore((s) => s.clear);
  const nav = useNavigate();

  if (status !== "won" && status !== "lost") return null;
  if (!report) return null;

  const won = status === "won";
  const nextLevel = levelId
    ? LEVELS[LEVELS.findIndex((l) => l.id === levelId) + 1]
    : undefined;

  return (
    <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="panel w-full max-w-2xl flex flex-col max-h-[85vh]">
        <div className="px-5 py-4 border-b border-cold-line flex items-center gap-3">
          {won ? (
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-6 h-6 text-rose-400" />
          )}
          <div className="flex-1">
            <div className="text-xl font-display font-bold text-white">
              {won ? "装载任务通关" : "装载任务失败"}
            </div>
            <div className="text-xs text-cold-mute">
              {report.levelName} · 耗时 {report.durationSec}s
            </div>
          </div>
          {failReason && (
            <div className="chip bg-rose-500/15 border-rose-400/60 text-rose-200">
              {failReason}
            </div>
          )}
        </div>

        <div className="px-5 py-4 grid grid-cols-4 gap-3 border-b border-cold-line text-center">
          <div className="panel p-2">
            <div className="text-[11px] text-cold-mute">得分</div>
            <div className="text-2xl font-display font-bold text-white">{report.score}</div>
          </div>
          <div className="panel p-2">
            <div className="text-[11px] text-cold-mute">基础</div>
            <div className="text-lg font-mono text-emerald-300">{report.baseScore || "-"}</div>
          </div>
          <div className="panel p-2">
            <div className="text-[11px] text-cold-mute">时间奖励</div>
            <div className="text-lg font-mono text-sky-300">+{report.timeBonus || 0}</div>
          </div>
          <div className="panel p-2">
            <div className="text-[11px] text-cold-mute">扣分</div>
            <div className="text-lg font-mono text-rose-300">-{report.penaltyTotal || 0}</div>
          </div>
        </div>

        <div className="px-5 py-3 flex-1 scroll-y">
          <div className="text-sm text-cold-mute mb-2">货物装载情况</div>
          <div className="grid grid-cols-2 gap-1.5 text-xs font-mono mb-4">
            {report.cargos.map((c) => (
              <div
                key={c.id}
                className={`flex items-center justify-between px-2 py-1 rounded border ${
                  c.placed
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
                    : "border-rose-500/40 bg-rose-500/10 text-rose-100"
                }`}
              >
                <span>#{c.destOrder} {c.name} <span className="opacity-60">[{c.zone}]</span></span>
                <span>{c.placed ? `(${c.x},${c.y})` : "未装"}</span>
              </div>
            ))}
          </div>

          {report.violations.length > 0 && (
            <>
              <div className="text-sm text-cold-mute mb-2">违规 / 扣分项 ({report.violations.length})</div>
              <div className="flex flex-col gap-1.5 text-xs">
                {report.violations.map((v) => (
                  <div key={v.id} className="panel px-3 py-2 flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="font-mono text-amber-200/90">{v.message}</span>
                    <span className="ml-auto font-mono text-rose-300">-{v.penalty}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="px-5 py-4 border-t border-cold-line flex flex-wrap items-center gap-2">
          <button
            className="btn btn-primary"
            onClick={() => resetLevel()}
          >
            <RotateCcw className="w-4 h-4" /> 再来一次
          </button>
          {won && nextLevel && (
            <button
              className="btn btn-primary"
              onClick={() => nav(`/play/${nextLevel.id}`)}
            >
              <Play className="w-4 h-4" /> 下一关
            </button>
          )}
          <button
            className="btn"
            onClick={() => {
              clear();
              nav("/");
            }}
          >
            <Home className="w-4 h-4" /> 回主菜单
          </button>
          <div className="ml-auto flex items-center gap-2">
            <button className="btn" onClick={() => downloadReportText(report)}>
              <Download className="w-4 h-4" /> TXT
            </button>
            <button className="btn" onClick={() => downloadReportJSON(report)}>
              <Download className="w-4 h-4" /> JSON
            </button>
            <button
              className="btn"
              onClick={() => {
                const w = window.open("", "_blank");
                if (w) {
                  w.document.write(`<pre>${reportToText(report)}</pre>`);
                  w.document.title = "装载报告";
                }
              }}
            >
              <X className="w-4 h-4" /> 预览
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
