import { useNavigate } from "react-router-dom";
import { LEVELS } from "../game/store";
import { useGameStore } from "../game/store";
import { useEffect } from "react";
import { History, Printer, Play } from "lucide-react";

export default function Home() {
  const nav = useNavigate();
  const history = useGameStore((s) => s.history);
  const loadHistory = useGameStore((s) => s.loadHistory);
  const startGame = useGameStore((s) => s.startGame);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-5xl">
        <div className="mb-8 flex items-end justify-between flex-wrap gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.4em] text-[#0A1F44]/60">
              IMPOSE MASTER
            </div>
            <h1 className="font-mono text-3xl md:text-4xl font-bold text-[#0A1F44] mt-2">
              印刷排产拼版游戏
            </h1>
            <p className="text-[#0A1F44]/70 mt-2 max-w-xl">
              新人培训模拟器：用纸、用墨、用时间，在 16 天内完成订单拼版与印刷。
              浪费、换色、超时都会真实扣钱。
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-[#0A1F44]/60">
            <Printer className="w-4 h-4" /> CMYK Simulator
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {LEVELS.map((lvl) => (
            <button
              key={lvl.id}
              className="card p-5 text-left hover:border-[#0A1F44] transition group"
              onClick={() => {
                startGame(lvl.id);
                nav("/game");
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-widest text-[#0A1F44]/60">
                  Level {lvl.id}
                </span>
                <span
                  className="text-[10px] px-2 py-0.5 rounded"
                  style={{
                    background:
                      lvl.id === 1
                        ? "#4a9d6d22"
                        : lvl.id === 2
                          ? "#2a6bbd22"
                          : "#c0392b22",
                    color:
                      lvl.id === 1
                        ? "#2e7a4e"
                        : lvl.id === 2
                          ? "#1e4a91"
                          : "#9c2c22",
                  }}
                >
                  {lvl.name}
                </span>
              </div>
              <div className="mt-3 font-mono text-xl text-[#0A1F44]">
                {lvl.name}
              </div>
              <div className="text-sm text-[#0A1F44]/70 mt-1">{lvl.description}</div>
              <div className="mt-4 text-xs grid grid-cols-2 gap-y-1 text-[#0A1F44]/70">
                <div>回合：{lvl.maxDays} 天</div>
                <div>订单：{lvl.maxOrders}</div>
                <div>开数：{lvl.formats.length} 种</div>
                <div>色组：{lvl.allowedColors.length} 种</div>
                <div>换色：¥{lvl.inkSwitchCost}</div>
                <div>目标：{lvl.targetScore}</div>
              </div>
              <div className="mt-4 flex items-center justify-end text-[#0A1F44] group-hover:text-[#E60012] transition">
                <Play className="w-4 h-4 mr-1" /> 开始
              </div>
            </button>
          ))}
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 text-[#0A1F44] mb-3">
            <History className="w-4 h-4" />
            历史回放（{history.length}）
          </div>
          {history.length === 0 ? (
            <div className="text-sm text-[#0A1F44]/50">
              还没有历史记录。完成一局后，回放会出现在这里。
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
              {history.map((h) => (
                <button
                  key={h.id}
                  className="border border-[#0A1F44]/15 rounded p-3 text-left hover:border-[#0A1F44]/60 transition text-xs"
                  onClick={() => {
                    useGameStore.getState().setReplay(h.id);
                    nav("/replay");
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">
                      {h.levelName}{" "}
                      <span
                        className={
                          h.result === "win"
                            ? "text-[#2e7a4e]"
                            : "text-[#E60012]"
                        }
                      >
                        {h.result === "win" ? "达标" : "未达标"}
                      </span>
                    </div>
                    <div className="text-[10px] text-[#0A1F44]/50">
                      {new Date(h.finishedAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-[#0A1F44]/70 mt-1">
                    分数 {h.score} / 现金 ¥{h.cash} / 用时 {h.days} 天
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 text-center text-[11px] text-[#0A1F44]/50">
          游戏内所有规则取材自真实印刷排产，数值已做教学化调整。
        </div>
      </div>
    </div>
  );
}
