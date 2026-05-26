import { useEffect, useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Radio } from "lucide-react";
import { getLevel } from "../engine/levels";
import { useGameStore } from "../store/gameStore";
import GameCanvas from "../components/GameCanvas";
import HUD from "../components/HUD";
import ResultModal from "../components/ResultModal";

export default function GamePage() {
  const { levelId = "" } = useParams();
  const navigate = useNavigate();
  const level = useMemo(() => getLevel(levelId), [levelId]);
  const startLevel = useGameStore((s) => s.startLevel);
  const phase = useGameStore((s) => s.phase);
  const setPhase = useGameStore((s) => s.setPhase);
  const currentLevelId = useGameStore((s) => s.levelId);
  const result = useGameStore((s) => s.result);
  const reset = useGameStore((s) => s.reset);
  const broadcasts = useGameStore((s) => s.broadcasts);
  const actions = useGameStore((s) => s.actions);

  useEffect(() => {
    if (level && currentLevelId !== levelId) {
      startLevel(levelId);
    }
  }, [level, levelId, currentLevelId, startLevel]);

  if (!level) {
    return (
      <div className="min-h-screen bg-[#06091a] text-slate-200 flex items-center justify-center">
        <div className="text-center">
          <div className="text-rose-400">找不到关卡 {levelId}</div>
          <Link to="/" className="text-sky-400 underline text-sm">回到主菜单</Link>
        </div>
      </div>
    );
  }

  function handleExport(format: "txt" | "json") {
    if (!result) return;
    const { score, coverage, complaints } = result;
    const lines = [
      "=== 应急广播部署报告 ===",
      `关卡: ${level.name} (${level.id})`,
      `时间: ${new Date().toLocaleString()}`,
      "",
      `结果: ${score.success ? "成功" : "失败"}  星级: ${score.stars}  总分: ${score.score}`,
      `覆盖率: ${Math.round((coverage?.coverageRatio ?? 0) * 100)}% (目标 ≥ ${Math.round(level.minCoverage * 100)}%)`,
      `投诉数: ${complaints?.count ?? 0} (上限 ${level.maxComplaints})`,
      `覆盖得分: ${score.coverageScore}`,
      `投诉扣分: -${score.complaintPenalty}`,
      `预算扣分: -${score.budgetPenalty}`,
      "",
      "设备部署:",
      ...broadcasts.map(
        (b, i) =>
          `  #${i + 1} slot=${b.slotId} 位置=(${b.x},${b.y}) 半径=${b.radius}px`
      ),
      "",
      `失败原因: ${score.failure ? score.failure.reason : "无"}`,
      "",
      `操作数: ${actions.length}`,
    ];
    const txt = lines.join("\n");
    if (format === "txt") {
      download(`report-${level.id}-${Date.now()}.txt`, txt, "text/plain");
    } else {
      const obj = {
        level: { id: level.id, name: level.name },
        result: { score, coverage, complaints },
        broadcasts,
        actions,
      };
      download(`report-${level.id}-${Date.now()}.json`, JSON.stringify(obj, null, 2), "application/json");
    }
  }

  return (
    <div className="min-h-screen bg-[#06091a] text-slate-100 flex flex-col">
      <header className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-900/70 backdrop-blur">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-slate-400 hover:text-slate-200">
            <ArrowLeft size={18} />
          </Link>
          <Radio size={18} className="text-sky-400" />
          <div>
            <div className="text-sm font-semibold">{level.name}</div>
            <div className="text-[11px] text-slate-500 font-mono">{level.description}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono">
          {phase === "paused" && (
            <span className="px-2 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
              已暂停
            </span>
          )}
          {phase === "playing" && (
            <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
              部署中
            </span>
          )}
          {phase === "finished" && (
            <span className="px-2 py-1 rounded bg-sky-500/10 text-sky-300 border border-sky-500/30">
              已结算
            </span>
          )}
        </div>
      </header>

      <main className="flex-1 p-4 grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4 overflow-hidden">
        <div className="min-h-[480px] lg:h-[calc(100vh-120px)]">
          <GameCanvas level={level} />
        </div>
        <div className="overflow-auto max-h-[calc(100vh-120px)]">
          <HUD level={level} />
        </div>
      </main>

      {result && (
        <ResultModal
          level={level}
          onRestart={() => {
            reset();
            startLevel(levelId);
          }}
          onNext={() => {
            const ids = ["l1", "l2", "l3"];
            const idx = ids.indexOf(levelId);
            const next = ids[idx + 1];
            if (next) navigate(`/game/${next}`);
            else navigate("/");
          }}
          onMenu={() => navigate("/")}
          onExport={handleExport}
        />
      )}

      {phase === "paused" && !result && (
        <div
          className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center"
          onClick={() => setPhase("playing")}
        >
          <div className="rounded-xl border border-amber-500/40 bg-slate-900 px-8 py-6 text-center">
            <div className="text-amber-300 text-2xl font-bold mb-2">已暂停</div>
            <div className="text-slate-400 text-sm">点击任意位置继续</div>
          </div>
        </div>
      )}
    </div>
  );
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
