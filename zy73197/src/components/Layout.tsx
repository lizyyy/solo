import { NavLink, Outlet } from "react-router-dom";
import { Gauge, History, Layers, FileDown, Crosshair } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "归因工作台", sub: "Workbench", icon: Gauge },
  { to: "/history", label: "历史与灰度", sub: "History", icon: History },
  { to: "/samples", label: "样例与异常", sub: "Samples", icon: Layers },
];

export default function Layout() {
  return (
    <div className="flex h-full min-h-0">
      <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-carbon-950/70 backdrop-blur-sm">
        <div className="flex items-center gap-3 px-5 py-6">
          <div className="relative grid h-10 w-10 place-items-center border border-amber/60 bg-amber/5">
            <Crosshair className="h-5 w-5 text-amber" />
            <span className="absolute -right-1 -top-1 h-2 w-2 animate-pulse-dot bg-amber" />
          </div>
          <div className="leading-tight">
            <div className="font-display text-base font-extrabold tracking-tightest text-bone">
              错题归因
            </div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-ash">
              attrib · v0.1 灰度
            </div>
          </div>
        </div>

        <nav className="mt-2 flex flex-col gap-1 px-3">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "group relative flex items-center gap-3 px-3 py-2.5 font-mono text-[13px] transition-colors",
                  isActive
                    ? "bg-amber/10 text-amber"
                    : "text-ash hover:bg-carbon-800/60 hover:text-bone",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      "absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 bg-amber transition-opacity",
                      isActive ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <item.icon className="h-4 w-4" />
                  <span className="flex-1">{item.label}</span>
                  <span className="text-[10px] uppercase tracking-wider opacity-50">{item.sub}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto px-3 pb-5">
          <div className="border border-line bg-carbon-900/60 p-3">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-ash">
              交接速查 · 阿宁
            </div>
            <ul className="space-y-1.5 text-[12px] text-bone/80">
              <li className="flex items-center gap-2">
                <Layers className="h-3 w-3 text-amber" /> 样例 → 样例与异常
              </li>
              <li className="flex items-center gap-2">
                <Crosshair className="h-3 w-3 text-block" /> 异常 → 工作台拦截卡
              </li>
              <li className="flex items-center gap-2">
                <FileDown className="h-3 w-3 text-pass" /> 导出 → 样例与异常
              </li>
            </ul>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
