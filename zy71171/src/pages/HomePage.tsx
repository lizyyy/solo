import { Link } from "react-router-dom";
import { Truck, Play, Clock, History, Trophy, AlertTriangle } from "lucide-react";
import { LEVELS } from "@/data/levels";
import { useHistoryStore } from "@/store/useHistoryStore";

export default function HomePage() {
  const { records } = useHistoryStore();
  const bestByLevel = new Map<string, number>();
  records.forEach((r) => {
    if (r.result !== "won") return;
    const cur = bestByLevel.get(r.levelId) ?? -1;
    if (r.score > cur) bestByLevel.set(r.levelId, r.score);
  });

  return (
    <div className="min-h-full flex flex-col">
      <header className="px-8 py-6 flex items-center gap-4 border-b border-cold-line">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-500 to-cyan-300 flex items-center justify-center shadow-glow">
          <Truck className="w-7 h-7 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-display font-bold tracking-wide text-white">
            冷链车装载模拟器
          </h1>
          <p className="text-cold-mute text-sm">
            2D 谜题 · 温层合规 · 卸货顺序 · 时效管理
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Link to="/history" className="btn">
            <History className="w-4 h-4" />
            历史回放
          </Link>
        </div>
      </header>

      <main className="flex-1 px-8 py-10">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {LEVELS.map((lvl) => {
            const best = bestByLevel.get(lvl.id);
            return (
              <div
                key={lvl.id}
                className="panel p-5 flex flex-col gap-4 hover:-translate-y-0.5 hover:shadow-glow transition"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs text-cold-mute">LEVEL {lvl.difficulty}</div>
                    <div className="text-xl font-display font-bold text-white">
                      {lvl.name}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Trophy
                        key={i}
                        className={`w-5 h-5 ${i < lvl.difficulty ? "text-amber-400" : "text-slate-700"}`}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-sm text-cold-text/80">{lvl.description}</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="chip zone-frozen">
                    <AlertTriangle className="w-3 h-3" /> 温层 {lvl.zoneLayout.flat().filter((z) => z === "frozen").length > 0 ? "含冻品" : ""}
                  </span>
                  <span className="chip zone-chilled">冷藏 {lvl.zoneLayout.flat().filter((z) => z === "chilled").length > 0 ? "有" : "无"}</span>
                  <span className="chip zone-ambient">常温 {lvl.zoneLayout.flat().filter((z) => z === "ambient").length > 0 ? "有" : "无"}</span>
                  <span className="chip border-slate-600 bg-slate-800/40 text-slate-300">
                    <Clock className="w-3 h-3" /> {lvl.timeLimitSec}s
                  </span>
                  <span className="chip border-slate-600 bg-slate-800/40 text-slate-300">
                    {lvl.cargos.length} 件货物
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-cold-line">
                  <div className="text-sm">
                    {best !== undefined ? (
                      <span className="text-emerald-300">最佳: <b>{best}</b> 分</span>
                    ) : (
                      <span className="text-cold-mute">暂无通关记录</span>
                    )}
                  </div>
                  <Link to={`/play/${lvl.id}`} className="btn btn-primary">
                    <Play className="w-4 h-4" /> 开始
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      <footer className="px-8 py-4 text-xs text-cold-mute border-t border-cold-line">
        规则真实可玩 · 支持历史回放与报告导出
      </footer>
    </div>
  );
}
