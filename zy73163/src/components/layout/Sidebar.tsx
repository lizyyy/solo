import { NavLink } from "react-router-dom";
import {
  Grid3x3,
  StickyNote,
  ShieldAlert,
  BookOpenCheck,
  Layers,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  desc: string;
  icon: typeof Grid3x3;
}

const NAV: NavItem[] = [
  { to: "/", label: "图表与异常", desc: "看异常、回溯口径", icon: Grid3x3 },
  { to: "/notes", label: "评分备注与材料", desc: "放材料、分来源", icon: StickyNote },
  { to: "/quarantine", label: "隔离与溯源", desc: "单位缺失、重新导出", icon: ShieldAlert },
  { to: "/handover", label: "交接与讲解", desc: "灰度讲解、印证", icon: BookOpenCheck },
];

const HANDOVER_ZONES = [
  { to: "/notes", label: "放材料", icon: StickyNote },
  { to: "/", label: "看异常", icon: Grid3x3 },
  { to: "/quarantine", label: "重新导出", icon: ShieldAlert },
];

export function Sidebar() {
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-line bg-surface">
      <div className="flex items-center gap-2.5 border-b border-line px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-ink text-bg">
          <Layers className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <div className="font-display text-sm font-semibold text-ink">MF Atlas</div>
          <div className="text-[10px] text-ink-mute">矩阵分解图表解释</div>
        </div>
      </div>

      <nav className="scroll-atlas flex-1 overflow-y-auto px-3 py-4">
        <div className="mb-2 px-2 font-mono-data text-[10px] uppercase tracking-wider text-ink-mute">
          导航
        </div>
        <ul className="space-y-1">
          {NAV.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  cn(
                    "group flex items-center gap-3 rounded-md border border-transparent px-2.5 py-2 transition-colors",
                    isActive
                      ? "border-line bg-surface-2 text-ink"
                      : "text-ink-soft hover:bg-surface-2 hover:text-ink",
                  )
                }
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-medium leading-tight">{item.label}</div>
                  <div className="text-[11px] leading-tight text-ink-mute">{item.desc}</div>
                </div>
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="mt-6 rounded-md border border-dashed border-line-strong bg-surface-2/60 p-3">
          <div className="mb-2 font-mono-data text-[10px] uppercase tracking-wider text-ink-mute">
            交接三区 · 不问也知道
          </div>
          <ul className="space-y-1.5">
            {HANDOVER_ZONES.map((z) => (
              <li key={z.to}>
                <NavLink
                  to={z.to}
                  className="flex items-center justify-between rounded-atlas px-2 py-1 text-xs text-ink-soft transition-colors hover:bg-surface hover:text-ink"
                >
                  <span className="flex items-center gap-2">
                    <z.icon className="h-3.5 w-3.5" />
                    {z.label}
                  </span>
                  <ArrowRight className="h-3 w-3 text-ink-mute" />
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      <div className="border-t border-line px-5 py-3">
        <p className="text-[10px] leading-relaxed text-ink-mute">
          历史备注写入本地，重启不丢。
          <br />
          当前状态可与页面摘要互相印证。
        </p>
      </div>
    </aside>
  );
}
