import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useGameStore } from "../game/store";
import OrderQueue from "../components/OrderQueue";
import ResourcePanel from "../components/ResourcePanel";
import ActionBar from "../components/ActionBar";
import ImpositionCanvas from "../components/ImpositionCanvas";
import { SHEET_SIZES, COLOR_LABELS } from "../game/types";
import { cn } from "../lib/utils";
import { ArrowLeft, FileDown, Medal } from "lucide-react";

export default function Game() {
  const nav = useNavigate();
  const state = useGameStore((s) => s.state);
  const selectSheet = useGameStore((s) => s.selectSheet);
  const exportReport = useGameStore((s) => s.exportReport);

  useEffect(() => {
    if (!state) nav("/");
  }, [state, nav]);

  if (!state) return null;

  function downloadReport() {
    const csv = exportReport();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `impose-report-${state.level.id}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (state.finished) {
    const win = state.result === "win";
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-3xl w-full card p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Medal className={cn("w-5 h-5", win ? "text-[#FFD100]" : "text-[#E60012]")} />
              <div className="font-mono text-2xl">
                {win ? "排产达标" : "排产未达标"}
              </div>
            </div>
            <div className="text-sm text-[#0A1F44]/60">
              {state.level.name} · {state.day}/{state.level.maxDays} 天
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-6">
            <Summary label="最终分数" value={String(state.score)} accent />
            <Summary label="剩余现金" value={`¥${state.cash}`} />
            <Summary
              label="失败原因"
              value={state.lossReason ?? "-"}
              danger={!win}
            />
          </div>
          <div className="mt-6">
            <div className="text-xs uppercase tracking-widest text-[#0A1F44]/60 mb-2">
              订单摘要
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs max-h-64 overflow-y-auto">
              {state.orders.map((o) => (
                <div
                  key={o.id}
                  className={cn(
                    "border rounded p-2",
                    o.status === "printed"
                      ? "border-[#2e7a4e]/40 bg-[#4a9d6d]/10"
                      : o.status === "failed"
                        ? "border-[#E60012]/40 bg-[#E60012]/10"
                        : "border-[#0A1F44]/20",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">
                      {o.id} {o.name}
                    </div>
                    <div className="text-[10px] px-1 rounded" style={{ background: COLOR_LABELS[o.colors].css + "22", color: COLOR_LABELS[o.colors].css }}>
                      {COLOR_LABELS[o.colors].label}
                    </div>
                  </div>
                  <div className="text-[#0A1F44]/70 mt-1">
                    {o.status === "printed" && `+¥${o.price}`}
                    {o.status === "failed" && (o.failedReason ?? "失败")}
                    {o.status === "queued" && "未排"}
                    {o.status === "imposed" && "已拼未印"}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-2 justify-end">
            <button
              className="btn-secondary text-xs"
              onClick={() => {
                useGameStore.getState().resetGame();
              }}
            >
              再来一局
            </button>
            <button className="btn-secondary text-xs" onClick={downloadReport}>
              <FileDown className="w-3 h-3 inline mr-1" /> 导出报告
            </button>
            <button className="btn-primary text-xs" onClick={() => nav("/")}>
              <ArrowLeft className="w-3 h-3 inline mr-1" /> 返回菜单
            </button>
          </div>
        </div>
      </div>
    );
  }

  const activeSheet = state.sheets.find((s) => s.id === state.selectedSheetId) ?? state.sheets[0];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 py-3 border-b border-[#0A1F44]/10 bg-white/70 backdrop-blur flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            className="text-xs text-[#0A1F44]/70 hover:text-[#0A1F44]"
            onClick={() => {
              useGameStore.getState().quitGame();
              nav("/");
            }}
          >
            ← 菜单
          </button>
          <div className="font-mono text-lg">
            {state.level.name} · D{state.day}/{state.level.maxDays}
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-[#0A1F44]/70">
          <div>分数 <span className="font-semibold text-[#0A1F44]">{state.score}</span> / {state.level.targetScore}</div>
          <div>现金 <span className="font-semibold text-[#0A1F44]">¥{state.cash}</span></div>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-12 gap-3 p-4">
        <aside className="col-span-3 card p-3">
          <OrderQueue />
        </aside>

        <main className="col-span-6 flex flex-col gap-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {state.sheets.map((s) => (
              <button
                key={s.id}
                onClick={() => selectSheet(s.id)}
                className={cn(
                  "text-xs px-3 py-1 rounded border flex items-center gap-2",
                  s.id === activeSheet.id
                    ? "bg-[#0A1F44] text-[#F7F3E9] border-[#0A1F44]"
                    : "bg-white text-[#0A1F44] border-[#0A1F44]/30 hover:border-[#0A1F44]/60",
                )}
              >
                <span className="font-mono">{s.id}</span>
                <span>{SHEET_SIZES[s.format].label}</span>
                {s.ink && (
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: COLOR_LABELS[s.ink].css }}
                  />
                )}
                {s.used && <span className="text-[10px] text-[#E60012]">已印</span>}
              </button>
            ))}
          </div>
          <ImpositionCanvas
            sheet={activeSheet}
            orders={state.orders}
            highlightOrderId={state.selectedOrderId}
          />
          <div className="card p-3">
            <ActionBar />
          </div>
        </main>

        <aside className="col-span-3 flex flex-col gap-3">
          <div className="card p-3">
            <ResourcePanel />
          </div>
          <div className="card p-3 flex-1 min-h-0 flex flex-col">
            <div className="text-xs uppercase tracking-widest text-[#0A1F44]/70 mb-2">
              操作日志
            </div>
            <div className="flex-1 overflow-y-auto text-[11px] text-[#0A1F44]/80 space-y-1">
              {state.logs.slice().reverse().slice(0, 60).map((l, idx) => (
                <div key={idx} className="flex gap-2">
                  <span className="text-[#0A1F44]/40 font-mono">D{l.day}</span>
                  <span>{l.message}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Summary({
  label,
  value,
  accent,
  danger,
}: {
  label: string;
  value: string;
  accent?: boolean;
  danger?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded border p-4",
        accent && "bg-[#FFD100]/20 border-[#FFD100]",
        danger && "bg-[#E60012]/10 border-[#E60012]/40 text-[#E60012]",
        !accent && !danger && "border-[#0A1F44]/20",
      )}
    >
      <div className="text-[10px] uppercase tracking-widest opacity-60">{label}</div>
      <div className="font-mono text-xl mt-1">{value}</div>
    </div>
  );
}
