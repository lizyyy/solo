import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Play, Trash2, Star, Download } from "lucide-react";
import { useGameStore } from "../store/gameStore";
import { getLevel } from "../engine/levels";
import { LEVELS } from "../engine/levels";

export default function HistoryPage() {
  const runs = useGameStore((s) => s.runs);
  const loadRuns = useGameStore((s) => s.loadRunsList);
  const deleteRunItem = useGameStore((s) => s.deleteRunItem);
  const playRun = useGameStore((s) => s.playRun);
  const navigate = useNavigate();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replayIndex, setReplayIndex] = useState(0);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  useEffect(() => {
    if (selectedId) {
      const run = runs.find((r) => r.runId === selectedId);
      if (run) setReplayIndex(run.actions.length - 1);
    }
  }, [selectedId, runs]);

  const selectedRun = runs.find((r) => r.runId === selectedId);

  return (
    <div className="min-h-screen bg-[#06091a] text-slate-100">
      <header className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-900/70">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-slate-400 hover:text-slate-200">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="text-sm font-semibold">历史对局</div>
            <div className="text-[11px] text-slate-500 font-mono">回放 / 导出 / 删除</div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5 py-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
            <div className="text-xs font-mono tracking-widest text-slate-400 mb-3">
              ● 对局列表（最近 30 条）
            </div>
            {runs.length === 0 ? (
              <div className="text-center text-slate-500 py-10 text-sm">
                暂无历史记录，去完成一局对局吧。
                <div className="mt-2">
                  <Link to="/" className="text-sky-400 underline">返回主菜单</Link>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {runs.map((r) => {
                  const lv = getLevel(r.levelId);
                  return (
                    <div
                      key={r.runId}
                      className={`rounded border px-3 py-2 text-xs cursor-pointer transition ${
                        selectedId === r.runId
                          ? "border-sky-500/60 bg-sky-500/5"
                          : "border-slate-800 bg-slate-950/40 hover:border-slate-600"
                      }`}
                      onClick={() => setSelectedId(r.runId)}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`font-mono ${r.score.success ? "text-emerald-300" : "text-rose-300"}`}>
                          {r.score.success ? "✓" : "✗"}
                        </span>
                        <span className="text-slate-200 font-semibold">
                          {lv?.name ?? r.levelId}
                        </span>
                        <span className="text-slate-500 ml-auto font-mono">
                          {new Date(r.finishedAt).toLocaleString()}
                        </span>
                        <span className="text-amber-300 flex items-center gap-0.5">
                          {[0, 1, 2].map((i) => (
                            <Star
                              key={i}
                              size={12}
                              className={
                                i < r.score.stars
                                  ? "text-amber-400 fill-amber-400"
                                  : "text-slate-700"
                              }
                            />
                          ))}
                        </span>
                        <span className="text-sky-300 font-mono">{r.score.score}</span>
                      </div>
                      <div className="mt-1 text-slate-500 font-mono text-[10px]">
                        覆盖 {Math.round((r.coverage?.coverageRatio ?? 0) * 100)}% ·
                        投诉 {r.complaints?.count ?? 0} ·
                        操作 {r.actions.length}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
            <div className="text-xs font-mono tracking-widest text-slate-400 mb-3">
              ● 详情
            </div>
            {!selectedRun ? (
              <div className="text-slate-500 text-xs">从左侧选择一条记录</div>
            ) : (
              <div className="space-y-3 text-xs">
                <div>
                  <div className="text-slate-500 text-[10px]">关卡</div>
                  <div className="text-slate-200">{getLevel(selectedRun.levelId)?.name ?? selectedRun.levelId}</div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Box label="得分" value={selectedRun.score.score} />
                  <Box label="星级" value={selectedRun.score.stars} />
                  <Box label="覆盖" value={`${Math.round((selectedRun.coverage?.coverageRatio ?? 0) * 100)}%`} />
                </div>
                {selectedRun.score.failure && (
                  <div className="rounded border border-rose-500/40 bg-rose-500/10 p-2 text-rose-300">
                    <div className="text-[10px]">失败原因</div>
                    <div>{selectedRun.score.failure.reason}</div>
                  </div>
                )}

                <div>
                  <div className="text-slate-500 text-[10px] mb-1">
                    回放 · {replayIndex + 1} / {selectedRun.actions.length}
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={selectedRun.actions.length - 1}
                    step={1}
                    value={replayIndex}
                    onChange={(e) => {
                      const idx = Number(e.target.value);
                      setReplayIndex(idx);
                      playRun(selectedRun.runId, idx);
                    }}
                    className="w-full accent-sky-400"
                  />
                  <button
                    onClick={() => {
                      playRun(selectedRun.runId, selectedRun.actions.length - 1);
                      navigate(`/game/${selectedRun.levelId}`);
                    }}
                    className="mt-2 w-full rounded border border-sky-500/40 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 py-1.5 text-xs flex items-center justify-center gap-1"
                  >
                    <Play size={12} /> 跳转到对局查看
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    onClick={() => exportRun(selectedRun, "txt")}
                    className="rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 py-1.5 text-xs flex items-center justify-center gap-1"
                  >
                    <Download size={12} /> TXT
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("确定删除该记录？")) deleteRunItem(selectedRun.runId);
                      setSelectedId(null);
                    }}
                    className="rounded border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 py-1.5 text-xs flex items-center justify-center gap-1"
                  >
                    <Trash2 size={12} /> 删除
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function Box({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded border border-slate-800 bg-slate-950/40 py-1 text-center">
      <div className="text-[9px] text-slate-500">{label}</div>
      <div className="text-sky-300 font-mono">{value}</div>
    </div>
  );
}

function exportRun(run: any, format: "txt" | "json") {
  const lv = getLevel(run.levelId);
  if (format === "txt") {
    const lines = [
      "=== 历史对局回放报告 ===",
      `关卡: ${lv?.name ?? run.levelId}`,
      `开始: ${new Date(run.startedAt).toLocaleString()}`,
      `结束: ${new Date(run.finishedAt).toLocaleString()}`,
      `得分: ${run.score.score}  星级: ${run.score.stars}  ${run.score.success ? "成功" : "失败"}`,
      `覆盖率: ${Math.round((run.coverage?.coverageRatio ?? 0) * 100)}%`,
      `投诉: ${run.complaints?.count ?? 0}`,
      `失败原因: ${run.score.failure?.reason ?? "无"}`,
      "",
      "操作序列:",
      ...run.actions.map(
        (a: any, i: number) =>
          `${String(i + 1).padStart(3, "0")}  [${new Date(a.at).toLocaleTimeString()}]  ${a.kind}  ${JSON.stringify(a.payload)}`
      ),
    ];
    const content = lines.join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `history-${run.runId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  } else {
    const blob = new Blob([JSON.stringify(run, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `history-${run.runId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  // prevent unused var warning
  void LEVELS;
}
