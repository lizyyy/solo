import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Play, BookOpen, AlertTriangle, ChevronRight, Trophy, Info } from "lucide-react";
import { LEVELS } from "@/levels";
import { useGameStore } from "@/store/gameStore";

export default function MainMenu() {
  const navigate = useNavigate();
  const loadBestScores = useGameStore((s) => s.loadBestScores);
  const bestScores = useGameStore((s) => s.bestScores);
  const setLevel = useGameStore((s) => s.setLevel);

  useEffect(() => {
    loadBestScores();
  }, [loadBestScores]);

  const difficultyStars = (n: number) => "★".repeat(n) + "☆".repeat(4 - n);

  return (
    <div className="min-h-screen bg-industrial-bg text-industrial-text flex flex-col">
      <header className="px-8 py-6 border-b border-industrial-border flex items-center justify-between">
        <div>
          <h1 className="font-display text-4xl tracking-widest text-industrial-accent">
            COIL · LIFTING · SIMULATOR
          </h1>
          <p className="text-industrial-dim text-sm font-mono mt-1">
            钢卷吊运平衡游戏 · 钢厂安全培训模拟器
          </p>
        </div>
        <div className="flex gap-3">
          <button className="btn btn-ghost">
            <Info size={14} />
            关于
          </button>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-12 gap-6 p-8">
        <aside className="col-span-4 space-y-4">
          <div className="panel">
            <div className="panel-title flex items-center gap-2">
              <BookOpen size={14} />
              规则说明
            </div>
            <ul className="text-xs space-y-2 text-industrial-dim font-mono">
              <li className="flex gap-2"><span className="text-industrial-accent">●</span>钢卷倾斜超过阈值 → 重心偏移，失败</li>
              <li className="flex gap-2"><span className="text-industrial-accent">●</span>吊运穿越人行通道 → 人员穿越，失败</li>
              <li className="flex gap-2"><span className="text-industrial-accent">●</span>吊运进入禁入区 → 区域碰撞，失败</li>
              <li className="flex gap-2"><span className="text-industrial-accent">●</span>多台行车距离过近 → 轨道冲突，失败</li>
              <li className="flex gap-2"><span className="text-industrial-accent">●</span>放错目标区 → 警告扣分</li>
            </ul>
          </div>

          <div className="panel">
            <div className="panel-title flex items-center gap-2">
              <AlertTriangle size={14} />
              边界案例
            </div>
            <ul className="text-xs space-y-2 text-industrial-dim font-mono">
              <li><span className="text-industrial-warn">[临界]</span> 倾斜 11.8° / 阈值 12° → 警告但未失败</li>
              <li><span className="text-industrial-warn">[临界]</span> 倾斜 12.1° / 阈值 12° → 重心超限失败</li>
              <li><span className="text-industrial-warn">[临界]</span> 吊运路径擦边人行通道 → 判定穿越</li>
              <li><span className="text-industrial-warn">[临界]</span> 多台行车 2.4m 间距 / 安全 2.5m → 冲突失败</li>
            </ul>
          </div>
        </aside>

        <section className="col-span-8 space-y-4">
          <div className="panel">
            <div className="panel-title flex items-center justify-between">
              <span>关卡选择</span>
              <span className="text-xs text-industrial-dim">共 {LEVELS.length} 关</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
              {LEVELS.map((level, idx) => {
                const best = bestScores[level.id];
                return (
                  <div
                    key={level.id}
                    onClick={() => {
                      setLevel(level.id);
                      navigate(`/game/${level.id}`);
                    }}
                    className="group relative bg-industrial-bg border border-industrial-border rounded-md p-4 cursor-pointer hover:border-industrial-accent hover:shadow-industrial transition-all"
                  >
                    <div className="absolute top-2 right-2 text-industrial-accent/60 text-xs font-mono">
                      L{idx + 1}
                    </div>
                    <div className="font-display text-xl text-white mb-1">
                      {level.name}
                    </div>
                    <div className="text-xs text-industrial-dim font-mono mb-3">
                      {level.description}
                    </div>
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-industrial-accent">
                        {difficultyStars(level.difficulty)}
                      </span>
                      <span className="text-industrial-dim">
                        {level.coils.length} 卷 / {level.maxMoves} 次
                      </span>
                    </div>
                    {best && (
                      <div className="mt-3 pt-3 border-t border-industrial-border/50 flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1 text-industrial-ok">
                          <Trophy size={12} />
                          最佳
                        </span>
                        <span
                          className={`font-mono ${
                            best.status === "success" ? "text-industrial-ok" : "text-industrial-warn"
                          }`}
                        >
                          {best.score}
                        </span>
                      </div>
                    )}
                    <div className="mt-3 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="btn btn-accent py-1 px-3 text-xs">
                        <Play size={12} />
                        开始
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="panel">
            <div className="panel-title">操作说明</div>
            <div className="grid grid-cols-3 gap-4 text-xs text-industrial-dim font-mono">
              <div>
                <div className="text-white mb-1">1. 选择钢卷</div>
                <div>场景中点击钢卷（灰色圆柱）</div>
              </div>
              <div>
                <div className="text-white mb-1">2. 指定目标</div>
                <div>点击绿色放卷区作为目的地</div>
              </div>
              <div>
                <div className="text-white mb-1">3. 启动吊运</div>
                <div>点击"开始吊运"按钮执行</div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <footer className="px-8 py-4 border-t border-industrial-border text-xs text-industrial-dim font-mono text-center">
        STEEL MILL SAFETY TRAINING · v0.1 · Click to start training
      </footer>
    </div>
  );
}
