import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  Upload,
  ClipboardCheck,
  ShieldCheck,
  FileText,
  Download,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "首页仪表盘" },
  { to: "/import", icon: Upload, label: "数据导入" },
  { to: "/review", icon: ClipboardCheck, label: "复盘工作台" },
  { to: "/selfcheck", icon: ShieldCheck, label: "自检面板" },
  { to: "/audit", icon: FileText, label: "审计追踪" },
  { to: "/export", icon: Download, label: "导出报告" },
];

export default function Layout() {
  const [role, setRole] = useState<"设备工程师" | "安全员">("设备工程师");
  const [roleOpen, setRoleOpen] = useState(false);

  return (
    <div className="flex h-screen bg-[#F8FAFC]">
      <aside className="flex w-60 shrink-0 flex-col bg-[#1B2A4A] text-white">
        <div className="px-5 py-6">
          <h1 className="text-lg font-bold tracking-wide">粮仓通风阻力复盘</h1>
        </div>

        <div className="relative px-4 pb-4">
          <button
            onClick={() => setRoleOpen(!roleOpen)}
            className="flex w-full items-center justify-between rounded-md bg-white/10 px-3 py-2 text-sm transition hover:bg-white/15"
          >
            <span>{role}</span>
            <ChevronDown
              size={16}
              className={cn(
                "transition-transform",
                roleOpen && "rotate-180"
              )}
            />
          </button>
          {roleOpen && (
            <div className="absolute left-4 right-4 top-full z-10 mt-1 overflow-hidden rounded-md bg-white shadow-lg">
              {(["设备工程师", "安全员"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => {
                    setRole(r);
                    setRoleOpen(false);
                  }}
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm transition",
                    r === role
                      ? "bg-[#1B2A4A] text-white"
                      : "text-[#1B2A4A] hover:bg-gray-100"
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          )}
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition",
                  isActive
                    ? "border-l-[3px] border-amber-500 bg-white/10 font-medium"
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                )
              }
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/10 px-5 py-4 text-xs text-white/40">
          v1.0.0
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
