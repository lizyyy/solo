import { Link } from "react-router-dom";
import { Radio, PlayCircle, History, BookOpen, Signal } from "lucide-react";
import { LEVELS } from "../engine/levels";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#06091a] text-slate-100 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(ellipse at 20% 10%, rgba(56,189,248,0.15), transparent 60%), radial-gradient(ellipse at 80% 90%, rgba(236,72,153,0.12), transparent 60%)",
        }}
      />
      <div className="relative max-w-5xl mx-auto px-6 py-10">
        <header className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/40">
              <Radio className="text-sky-400" size={24} />
            </div>
            <div>
              <div className="font-mono text-xs tracking-[0.3em] text-sky-300">
                EMERGENCY BROADCAST
              </div>
              <div className="text-2xl font-bold">应急广播覆盖游戏</div>
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              to="/history"
              className="flex items-center gap-2 rounded border border-slate-700 bg-slate-800/60 hover:bg-slate-700 px-3 py-2 text-sm"
            >
              <History size={16} /> 历史
            </Link>
          </div>
        </header>

        <section className="mb-10">
          <div className="rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-900 to-slate-950 p-6 shadow-xl">
            <div className="flex items-center gap-2 text-amber-300 text-xs font-mono tracking-widest mb-3">
              <Signal size={14} /> 任务简报
            </div>
            <h1 className="text-3xl font-bold mb-2 leading-tight">
              在「<span className="text-sky-300">覆盖</span>」与「<span className="text-rose-300">投诉</span>
              」之间寻找平衡
            </h1>
            <p className="text-slate-400 text-sm max-w-2xl leading-relaxed">
              你是社区应急演练的广播部署负责人。在每一张小区地图上，把有限的广播设备部署到可选点位，
              调整每台设备的覆盖半径，<span className="text-sky-300">尽量覆盖所有楼栋</span>，
              同时<span className="text-amber-300">避免让敏感区产生噪声投诉</span>，
              并且<span className="text-emerald-300">不能超出预算</span>。
            </p>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <Tip icon="🎯" title="覆盖楼栋" desc="每栋楼只要中心点落在任一广播半径内即被覆盖。" />
              <Tip icon="📣" title="噪声投诉" desc="敏感区（医院/图书馆/敬老院）叠加噪声超阈值会触发投诉。" />
              <Tip icon="💰" title="预算约束" desc="每台设备随半径增加费用，多设备叠加不可超预算。" />
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-center gap-2 text-slate-400 font-mono text-xs tracking-widest mb-4">
            <BookOpen size={14} /> 选择关卡
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {LEVELS.map((lv) => (
              <Link
                key={lv.id}
                to={`/game/${lv.id}`}
                className="group rounded-xl border border-slate-700 bg-slate-900/80 hover:bg-slate-800 hover:border-sky-500/60 transition p-5 block"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="font-mono text-xs text-sky-400">{lv.id.toUpperCase()}</div>
                  <PlayCircle size={20} className="text-slate-500 group-hover:text-sky-400" />
                </div>
                <div className="text-lg font-bold mb-1">{lv.name}</div>
                <div className="text-xs text-slate-400 mb-4 leading-relaxed">{lv.description}</div>
                <div className="grid grid-cols-3 gap-2 text-[11px] font-mono">
                  <KV label="楼栋" value={lv.buildings.length} />
                  <KV label="敏感" value={lv.noisyZones.length} />
                  <KV label="预算" value={lv.budget} />
                </div>
              </Link>
            ))}
          </div>
        </section>

        <footer className="mt-12 text-center text-[11px] text-slate-600">
          鼠标左键放置/选中 · 右键或 Shift+点击 撤回 · 滚轮调节半径 · 结算后可导出报告
        </footer>
      </div>
    </div>
  );
}

function Tip({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
      <div className="text-lg">{icon}</div>
      <div className="text-sm font-semibold text-slate-200 mt-1">{title}</div>
      <div className="text-[11px] text-slate-400 mt-1 leading-relaxed">{desc}</div>
    </div>
  );
}

function KV({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded border border-slate-800 bg-slate-950/50 py-1 text-center">
      <div className="text-[9px] text-slate-500">{label}</div>
      <div className="text-sky-300">{value}</div>
    </div>
  );
}
