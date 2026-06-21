import { useMemo } from "react";
import { NavLink } from "react-router-dom";
import { FileSearch, FileText, CalendarCheck2, AlertTriangle, FileBarChart } from "lucide-react";
import { usePreReviewStore } from "@/store/preReviewStore";

const navItems = [
  { to: "/", label: "预审面板", Icon: FileSearch },
  { to: "/review", label: "月底复核", Icon: CalendarCheck2 },
  { to: "/visa", label: "签证单", Icon: FileText },
  { to: "/report", label: "预审报告", Icon: FileBarChart },
];

export default function AppNav() {
  const collisions = usePreReviewStore((s) => s.collisions);
  const pending = useMemo(
    () => collisions.filter((c) => c.status === "pending" || c.isDuplicate).length,
    [collisions]
  );

  return (
    <header className="sticky top-0 z-30 border-b border-ink-800/80 bg-ink-950/80 backdrop-blur">
      <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-gradient-to-br from-amber-500 to-red-500 flex items-center justify-center shadow-lg shadow-amber-900/20">
            <AlertTriangle className="w-4 h-4 text-ink-950" strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-sm font-semibold text-ink-100 leading-tight">旧楼测绘碰撞预审</div>
            <div className="text-[10px] text-ink-500 leading-tight">结构工程师 · 老叶工作台</div>
          </div>
        </div>
        <nav className="flex items-center gap-1">
          {navItems.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `relative px-3 py-1.5 rounded-md text-xs font-medium transition flex items-center gap-1.5 ${
                  isActive
                    ? "text-amber-300 bg-ink-800/80"
                    : "text-ink-400 hover:text-ink-200 hover:bg-ink-800/40"
                }`
              }
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
              {to === "/review" && pending > 0 && (
                <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-red-500/90 text-[10px] text-white font-mono-num">
                  {pending}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}
