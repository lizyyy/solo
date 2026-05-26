import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Play, Pause, RotateCcw, Info } from "lucide-react";
import { GameCanvas } from "@/components/GameCanvas";
import { CenterOfMassHUD } from "@/components/CenterOfMassHUD";
import { EventLog } from "@/components/EventLog";
import { useGameStore } from "@/store/gameStore";
import { useGameEngine } from "@/hooks/useGameEngine";
import { getLevel } from "@/levels";

export default function GameScene() {
  const { levelId } = useParams<{ levelId: string }>();
  const navigate = useNavigate();
  const setLevel = useGameStore((s) => s.setLevel);
  const currentLevel = useGameStore((s) => s.currentLevel);
  const status = useGameStore((s) => s.status);
  const phase = useGameStore((s) => s.phase);
  const startSession = useGameStore((s) => s.startSession);
  const timeRemaining = useGameStore((s) => s.timeRemaining);
  const session = useGameStore((s) => s.session);
  const { startLift } = useGameEngine();

  useEffect(() => {
    if (levelId) {
      const lvl = getLevel(levelId);
      if (!lvl) {
        navigate("/");
        return;
      }
      setLevel(levelId);
      startSession();
    }
  }, [levelId, setLevel, startSession, navigate]);

  useEffect(() => {
    if (timeRemaining <= 0 && status === "running") {
      const s = useGameStore.getState();
      s.failSession("info" as any, "时间耗尽");
    }
  }, [timeRemaining, status]);

  useEffect(() => {
    if (status === "failed" || status === "success") {
      if (levelId && session) {
        const timer = setTimeout(() => {
          navigate(`/result/${levelId}`, { replace: false });
        }, 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [status, session, levelId, navigate]);

  if (!currentLevel) {
    return (
      <div className="min-h-screen flex items-center justify-center text-industrial-dim">
        加载中...
      </div>
    );
  }

  const canStart =
    (phase === "planning" || phase === "selecting") &&
    useGameStore.getState().selectedCoilId !== null &&
    useGameStore.getState().selectedZoneId !== null;

  const isRunning = phase === "lifting" || phase === "moving" || phase === "lowering";

  return (
    <div className="min-h-screen bg-industrial-bg text-industrial-text flex flex-col">
      <header className="px-6 py-3 border-b border-industrial-border flex items-center justify-between bg-industrial-panel/50 backdrop-blur">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/")}
            className="btn btn-ghost !py-1 !px-2"
            title="返回主菜单"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="font-display text-2xl text-industrial-accent tracking-widest">
              {currentLevel.name}
            </div>
            <div className="text-xs text-industrial-dim font-mono">
              L{currentLevel.id.replace(/\D/g, "")} · {currentLevel.description}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="stat-chip">
            剩余时间 <span className="text-industrial-accent">{Math.ceil(timeRemaining)}s</span>
          </div>
          <div className="stat-chip">
            回合 <span className="text-industrial-accent">{session?.movesUsed || 0}/{currentLevel.maxMoves}</span>
          </div>
          <div
            className={`stat-chip ${
              status === "running"
                ? "border-industrial-ok text-industrial-ok"
                : status === "paused"
                ? "border-industrial-accent text-industrial-accent"
                : status === "failed"
                ? "border-industrial-warn text-industrial-warn"
                : status === "success"
                ? "border-industrial-ok text-industrial-ok"
                : "border-industrial-border text-industrial-dim"
            }`}
          >
            {status.toUpperCase()}
          </div>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-12 gap-4 p-4 min-h-0">
        <aside className="col-span-2 space-y-4 min-h-0 overflow-y-auto">
          <CenterOfMassHUD />
        </aside>

        <section className="col-span-7 relative panel !p-0 overflow-hidden min-h-0">
          <div className="absolute inset-0">
            <GameCanvas level={currentLevel} />
          </div>

          {(status === "failed" || status === "success") && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-10">
              <div
                className={`panel text-center ${
                  status === "failed" ? "border-industrial-warn" : "border-industrial-ok"
                }`}
              >
                <div
                  className={`font-display text-4xl mb-2 ${
                    status === "failed" ? "text-industrial-warn" : "text-industrial-ok"
                  }`}
                >
                  {status === "failed" ? "作业失败" : "作业完成"}
                </div>
                <div className="text-industrial-dim font-mono text-sm mb-4">
                  {status === "failed"
                    ? useGameStore.getState().failureReason || "触发事故规则"
                    : "所有钢卷已成功吊运"}
                </div>
                <div className="text-xs text-industrial-dim">跳转到结算页...</div>
              </div>
            </div>
          )}

          <div className="absolute top-2 left-2 flex items-center gap-2 text-xs font-mono text-industrial-dim pointer-events-none">
            <Info size={12} />
            俯视 30° · 正交投影 · 车间作业区
          </div>
        </section>

        <aside className="col-span-3 space-y-4 min-h-0 overflow-y-auto">
          <div className="panel space-y-2">
            <div className="panel-title">吊运控制</div>
            <div className="grid grid-cols-2 gap-2">
              <button
                className="btn btn-accent"
                disabled={!canStart}
                onClick={() => {
                  const s = useGameStore.getState();
                  if (s.selectedCoilId && s.selectedZoneId) {
                    startLift();
                  }
                }}
              >
                <Play size={14} />
                开始吊运
              </button>
              <button
                className="btn"
                onClick={() => {
                  const s = useGameStore.getState();
                  if (s.status === "running") {
                    s.setStatus("paused");
                  } else if (s.status === "paused") {
                    s.setStatus("running");
                  }
                }}
                disabled={!isRunning && status !== "paused"}
              >
                {status === "paused" ? <Play size={14} /> : <Pause size={14} />}
                {status === "paused" ? "继续" : "暂停"}
              </button>
              <button className="btn col-span-2" onClick={() => startSession()}>
                <RotateCcw size={14} />
                重新开始
              </button>
            </div>

            <div className="text-xs text-industrial-dim space-y-1 pt-3 border-t border-industrial-border">
              <div>
                已选钢卷：
                <span className="text-industrial-accent font-mono">
                  {useGameStore.getState().selectedCoilId || "—"}
                </span>
              </div>
              <div>
                目标区域：
                <span className="text-industrial-ok font-mono">
                  {useGameStore.getState().selectedZoneId || "—"}
                </span>
              </div>
              <div>
                当前阶段：
                <span className="text-white font-mono">{phase}</span>
              </div>
            </div>
          </div>

          <EventLog />

          <div className="panel">
            <div className="panel-title">图例</div>
            <div className="space-y-1.5 text-xs font-mono">
              <Legend color="#3b82f6" label="取卷区 (pickup)" />
              <Legend color="#16a34a" label="放卷区 (dropoff)" />
              <Legend color="#f59e0b" label="人行通道 (禁止穿越)" />
              <Legend color="#7c2d12" label="禁入区 (restricted)" />
              <Legend color="#8b949e" label="钢卷 (coil)" />
              <Legend color="#ff8c1a" label="行车/轨道 (crane)" />
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-3 h-3 rounded-sm" style={{ background: color }} />
      <span className="text-industrial-dim">{label}</span>
    </div>
  );
}
