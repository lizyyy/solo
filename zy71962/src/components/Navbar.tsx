import { NavLink } from "react-router-dom";
import { PanelLeft, AlertTriangle } from "lucide-react";
import { useStore } from "@/store";
import { cn } from "@/lib/utils";

const navLinks = [
  { to: "/", label: "对账主界面" },
  { to: "/evaluation", label: "评估说明" },
  { to: "/audit-log", label: "操作留痕" },
  { to: "/leak-detection", label: "泄漏检测" },
];

export default function Navbar() {
  const { toggleSidebar, leakAlerts } = useStore();
  const unresolvedCount = leakAlerts.filter((a) => !a.isResolved).length;

  return (
    <nav className="h-14 bg-zinc-950 border-b border-zinc-800 flex items-center px-4 gap-4 shrink-0 z-30">
      <button
        onClick={toggleSidebar}
        className="p-1.5 rounded hover:bg-zinc-800 transition-colors"
      >
        <PanelLeft className="w-5 h-5 text-zinc-400" />
      </button>

      <h1 className="font-mono-display text-amber-500 font-semibold text-lg tracking-tight">
        特征口径对账
      </h1>

      <div className="flex items-center gap-1 ml-8">
        {navLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === "/"}
            className={({ isActive }) =>
              cn(
                "px-3 py-1.5 text-sm rounded transition-colors relative",
                isActive
                  ? "text-amber-400 font-medium"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              )
            }
          >
            {({ isActive }) => (
              <>
                {link.label}
                {isActive && (
                  <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-amber-500 rounded-full" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>

      <div className="ml-auto">
        {unresolvedCount > 0 && (
          <NavLink
            to="/leak-detection"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors text-sm"
          >
            <AlertTriangle className="w-4 h-4" />
            <span className="font-mono-display">{unresolvedCount}</span>
          </NavLink>
        )}
      </div>
    </nav>
  );
}
