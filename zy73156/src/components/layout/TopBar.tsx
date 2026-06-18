import { NavLink } from "react-router-dom";
import { Activity, GitBranch, Waves } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFilteredSamples } from "@/store/useOceanStore";

const NAV = [
  { to: "/", label: "预警驾驶舱", icon: Waves, end: true },
  { to: "/history", label: "历史版本台", icon: GitBranch, end: false },
  { to: "/drift", label: "漂移分析", icon: Activity, end: false },
];

export default function TopBar() {
  const filtered = useFilteredSamples();
  const blocked = filtered.reduce(
    (n, s) => n + s.readings.filter((r) => r.status === "blocked").length,
    0,
  );
  const warning = filtered.reduce(
    (n, s) => n + s.readings.filter((r) => r.status === "warning").length,
    0,
  );

  return (
    <header className="relative z-30 flex h-14 shrink-0 items-center justify-between border-b border-glow-cyan/10 bg-abyss-950/80 px-4 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <div className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-glow-cyan/40 bg-glow-cyan/10 shadow-glow">
          <Waves className="h-4 w-4 text-glow-cyan" />
        </div>
        <div className="leading-tight">
          <div className="font-display text-[13px] font-bold tracking-[0.18em] text-gradient-cyan">
            ABYSS SENTINEL
          </div>
          <div className="font-mono text-[9px] tracking-[0.3em] text-slate-500">
            深海采样异常预警
          </div>
        </div>
      </div>

      <nav className="flex items-center gap-1">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "group flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-[11px] tracking-wide transition",
                isActive
                  ? "bg-glow-cyan/15 text-glow-cyan shadow-glow"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
              )
            }
          >
            <item.icon className="h-3.5 w-3.5" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-1 sm:flex">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 animate-breathe rounded-full bg-warn-amber" />
            <span className="font-mono text-[10px] text-slate-400">
              预警 <span className="text-warn-amber">{warning}</span>
            </span>
          </span>
          <span className="h-3 w-px bg-white/10" />
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 animate-breathe rounded-full bg-block-rose" />
            <span className="font-mono text-[10px] text-slate-400">
              拦截 <span className="text-block-rose">{blocked}</span>
            </span>
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-glow-cyan/20 bg-glow-cyan/5 px-2.5 py-1">
          <span className="h-2 w-2 animate-breathe rounded-full bg-ok-emerald shadow-glow" />
          <span className="font-mono text-[10px] text-slate-300">在线 · 换班前</span>
        </div>
      </div>
    </header>
  );
}
