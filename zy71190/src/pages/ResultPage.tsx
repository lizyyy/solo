import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Download, Play, Pause, RotateCcw, SkipBack, SkipForward } from "lucide-react";
import { useGameStore } from "@/store/gameStore";
import { getLevel } from "@/levels";
import { buildReport, downloadJSON, downloadText, reportToText } from "@/utils/report";
import type { GameEvent, Snapshot } from "@/types/game";

export default function ResultPage() {
  const { levelId } = useParams<{ levelId: string }>();
  const navigate = useNavigate();
  const session = useGameStore((s) => s.session);
  const currentLevel = useGameStore((s) => s.currentLevel);
  const setLevel = useGameStore((s) => s.setLevel);
  const loadBestScores = useGameStore((s) => s.loadBestScores);

  const [replayIndex, setReplayIndex] = useState(0);
  const [replayPlaying, setReplayPlaying] = useState(false);
  const [replayTime, setReplayTime] = useState(0);
  const rafRef = useRef<number>();

  useEffect(() => {
    if (levelId) {
      const lvl = getLevel(levelId);
      if (lvl) {
        setLevel(levelId);
      } else {
        navigate("/");
        return;
      }
    }
    loadBestScores();
  }, [levelId, setLevel, loadBestScores, navigate]);

  useEffect(() => {
    if (!replayPlaying || !session || session.snapshots.length === 0) {
      return;
    }
    let lastT = performance.now();
    const tick = (t: number) => {
      const dt = (t - lastT) / 1000;
      lastT = t;
      setReplayTime((prev) => {
        const next = prev + dt * 0.8;
        const totalDuration = session.snapshots.length * 0.05;
        if (next >= totalDuration) {
          setReplayPlaying(false);
          return totalDuration;
        }
        const idx = Math.min(
          session.snapshots.length - 1,
          Math.floor(next / 0.05),
        );
        setReplayIndex(idx);
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [replayPlaying, session]);

  if (!session || !currentLevel) {
    return (
      <div className="min-h-screen flex items-center justify-center text-industrial-dim">
        暂无结算数据
      </div>
    );
  }

  const report = buildReport(session, currentLevel);

  const handleExportJSON = () => {
    downloadJSON(`coil-report-${session.id}.json`, report);
  };

  const handleExportText = () => {
    downloadText(`coil-report-${session.id}.txt`, reportToText(report));
  };

  const failedEvents = session.events.filter((e) => e.severity === "critical" || e.severity === "warning");

  const getEventIcon = (type: GameEvent["type"]) => {
    const map: Record<string, string> = {
      center_of_mass: "⚖️",
      rail_conflict: "🛤️",
      zone_collision: "⚠️",
      personnel_cross: "🚶",
      wrong_zone: "📦",
      success: "✅",
      info: "ℹ️",
    };
    return map[type] || "•";
  };

  const getEventColor = (severity: GameEvent["severity"]) => {
    if (severity === "critical") return "text-industrial-warn border-industrial-warn/30 bg-industrial-warn/10";
    if (severity === "warning") return "text-industrial-accent border-industrial-accent/30 bg-industrial-accent/10";
    if (severity === "success") return "text-industrial-ok border-industrial-ok/30 bg-industrial-ok/10";
    return "text-industrial-dim border-industrial-border bg-industrial-bg/40";
  };

  return (
    <div className="min-h-screen bg-industrial-bg text-industrial-text flex flex-col">
      <header className="px-6 py-3 border-b border-industrial-border flex items-center justify-between bg-industrial-panel/50 backdrop-blur">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/")} className="btn btn-ghost !py-1 !px-2">
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="font-display text-2xl text-industrial-accent tracking-widest">
              结算报告
            </div>
            <div className="text-xs text-industrial-dim font-mono">
              {currentLevel.name} · {report.sessionId.slice(0, 12)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-ghost" onClick={handleExportJSON}>
            <Download size={14} />
            导出 JSON
          </button>
          <button className="btn btn-ghost" onClick={handleExportText}>
            <Download size={14} />
            导出文本
          </button>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-12 gap-4 p-6">
        <section className="col-span-8 space-y-4">
          <div className="panel">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-industrial-dim font-mono mb-1">
                  {report.status === "success" ? "作业状态" : "失败原因"}
                </div>
                <div
                  className={`font-display text-3xl ${
                    report.status === "success" ? "text-industrial-ok" : "text-industrial-warn"
                  }`}
                >
                  {report.status === "success" ? "作业完成" : "作业失败"}
                </div>
                {report.failureReason && (
                  <div className="text-industrial-dim text-sm font-mono mt-2">
                    {report.failureType} — {report.failureReason}
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="text-xs text-industrial-dim font-mono mb-1">最终得分</div>
                <div className="font-display text-5xl text-industrial-accent">
                  {report.score}
                </div>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-title">事件列表</div>
            {report.entries.length === 0 ? (
              <div className="text-industrial-dim text-sm py-4 text-center">
                无事件记录
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {session.events.map((e, i) => (
                  <div
                    key={e.id}
                    className={`flex items-start gap-3 p-3 rounded border ${getEventColor(e.severity)}`}
                  >
                    <div className="text-xl flex-shrink-0">{getEventIcon(e.type)}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs text-industrial-dim">
                          [{String(i + 1).padStart(3, "0")}]
                        </span>
                        <span className="text-xs uppercase tracking-wider font-bold">
                          {e.type}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-sm ${
                            e.severity === "critical"
                              ? "bg-industrial-warn/30 text-industrial-warn"
                              : e.severity === "warning"
                              ? "bg-industrial-accent/30 text-industrial-accent"
                              : "bg-industrial-ok/30 text-industrial-ok"
                          }`}
                        >
                          {e.severity}
                        </span>
                      </div>
                      <div className="text-sm">{e.detail}</div>
                      {e.position && (
                        <div className="text-xs text-industrial-dim font-mono mt-1">
                          位置: ({e.position.x.toFixed(2)}, {e.position.y.toFixed(2)},{" "}
                          {e.position.z.toFixed(2)})
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {failedEvents.length > 0 && (
            <div className="panel border-industrial-warn/40">
              <div className="panel-title text-industrial-warn">失败原因分析</div>
              <ul className="text-sm space-y-2">
                {failedEvents.map((e) => (
                  <li key={e.id} className="flex gap-2 text-industrial-dim">
                    <span className="text-industrial-warn">●</span>
                    <span>
                      <span className="text-industrial-warn">{e.type}</span>: {e.detail}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <aside className="col-span-4 space-y-4">
          <div className="panel">
            <div className="panel-title">历史回放</div>
            {session.snapshots.length === 0 ? (
              <div className="text-industrial-dim text-sm py-4 text-center">
                无回放数据
              </div>
            ) : (
              <div className="space-y-3">
                <div className="h-24 bg-industrial-bg rounded-sm border border-industrial-border p-2 overflow-hidden">
                  <div className="h-full relative">
                    {session.snapshots.map((snap, i) => {
                      const x = (i / session.snapshots.length) * 100;
                      const coilCount = Object.keys(snap.coilPositions).length;
                      return (
                        <div
                          key={i}
                          className={`absolute bottom-0 w-1 rounded-t-sm ${
                            i === replayIndex
                              ? "bg-industrial-accent h-full"
                              : snap.status === "failed"
                              ? "bg-industrial-warn/50"
                              : snap.status === "success"
                              ? "bg-industrial-ok/50"
                              : "bg-industrial-blue/50"
                          }`}
                          style={{
                            left: `${x}%`,
                            height: `${Math.min(100, coilCount * 20)}%`,
                          }}
                          title={`帧 ${i}`}
                        />
                      );
                    })}
                    {session.events.map((e) => {
                      if (e.frame < 0 || e.frame >= session.snapshots.length) return null;
                      const x = (e.frame / session.snapshots.length) * 100;
                      return (
                        <div
                          key={`ev-${e.id}`}
                          className="absolute top-0 w-px h-full"
                          style={{
                            left: `${x}%`,
                            background:
                              e.severity === "critical"
                                ? "#d9363e"
                                : e.severity === "warning"
                                ? "#ff8c1a"
                                : "#16a34a",
                          }}
                          title={e.detail}
                        />
                      );
                    })}
                  </div>
                </div>

                <div className="text-xs text-industrial-dim font-mono flex justify-between">
                  <span>帧 {replayIndex}</span>
                  <span>总 {session.snapshots.length} 帧</span>
                </div>

                <div className="flex items-center justify-center gap-2">
                  <button
                    className="btn !px-2 !py-1"
                    onClick={() => setReplayIndex(Math.max(0, replayIndex - 1))}
                    disabled={replayIndex === 0}
                  >
                    <SkipBack size={14} />
                  </button>
                  <button
                    className="btn"
                    onClick={() => setReplayPlaying(!replayPlaying)}
                  >
                    {replayPlaying ? <Pause size={14} /> : <Play size={14} />}
                    {replayPlaying ? "暂停" : "播放"}
                  </button>
                  <button
                    className="btn !px-2 !py-1"
                    onClick={() =>
                      setReplayIndex(
                        Math.min(session.snapshots.length - 1, replayIndex + 1),
                      )
                    }
                    disabled={replayIndex >= session.snapshots.length - 1}
                  >
                    <SkipForward size={14} />
                  </button>
                  <button
                    className="btn btn-ghost !px-2 !py-1"
                    onClick={() => {
                      setReplayIndex(0);
                      setReplayTime(0);
                      setReplayPlaying(false);
                    }}
                  >
                    <RotateCcw size={14} />
                  </button>
                </div>

                <input
                  type="range"
                  min={0}
                  max={session.snapshots.length - 1}
                  value={replayIndex}
                  onChange={(e) => setReplayIndex(Number(e.target.value))}
                  className="w-full accent-industrial-accent"
                />

                {session.snapshots[replayIndex] && (
                  <div className="text-xs text-industrial-dim font-mono bg-industrial-bg p-2 rounded-sm space-y-0.5">
                    <div>阶段: <span className="text-white">{session.snapshots[replayIndex].phase}</span></div>
                    <div>状态: <span className="text-white">{session.snapshots[replayIndex].status}</span></div>
                    <div>当前钢卷: <span className="text-white">{session.snapshots[replayIndex].currentCoilId || "—"}</span></div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="panel">
            <div className="panel-title">统计概览</div>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <Stat label="总分" value={report.score} highlight />
              <Stat label="移动次数" value={report.movesUsed} />
              <Stat label="严重事件" value={report.criticalCount} warn={report.criticalCount > 0} />
              <Stat label="警告事件" value={report.warningCount} warn={report.warningCount > 0} />
              <Stat label="总事件" value={report.totalEvents} />
              <Stat label="总帧数" value={session.totalFrames} />
            </div>
          </div>

          <button
            className="btn btn-accent w-full"
            onClick={() => {
              navigate(`/game/${levelId}`);
            }}
          >
            <RotateCcw size={14} />
            重新挑战
          </button>

          <button
            className="btn btn-ghost w-full"
            onClick={() => navigate("/")}
          >
            <ArrowLeft size={14} />
            返回关卡选择
          </button>
        </aside>
      </main>
    </div>
  );
}

function Stat({ label, value, highlight, warn }: { label: string; value: number | string; highlight?: boolean; warn?: boolean }) {
  return (
    <div className="bg-industrial-bg rounded-sm p-2 border border-industrial-border">
      <div className="text-industrial-dim">{label}</div>
      <div
        className={`text-lg font-display ${
          highlight ? "text-industrial-accent" : warn ? "text-industrial-warn" : "text-white"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
