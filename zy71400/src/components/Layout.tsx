import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, FileInput, Settings, ClipboardCheck, Download } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "首页", icon: LayoutDashboard },
  { to: "/entry", label: "录入", icon: FileInput },
  { to: "/process", label: "处理", icon: Settings },
  { to: "/review", label: "复核", icon: ClipboardCheck },
  { to: "/export", label: "导出", icon: Download },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <div className="flex min-h-screen bg-brand-bg">
      <aside className="fixed left-0 top-0 z-30 flex h-screen w-56 flex-col border-r border-slate-700 bg-slate-800">
        <div className="flex h-14 items-center border-b border-slate-700 px-4">
          <span className="text-sm font-bold tracking-wide text-brand-text-primary">
            回购质押券折算系统
          </span>
        </div>
        <nav className="flex-1 space-y-1 px-2 py-3">
          {navItems.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-slate-700 text-brand-text-primary"
                    : "text-brand-text-secondary hover:bg-slate-700/50 hover:text-brand-text-primary"
                )}
              >
                <item.icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="ml-56 flex-1">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
