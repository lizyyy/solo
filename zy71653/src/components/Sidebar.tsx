import { Link, useLocation } from "react-router-dom";
import {
  BarChart3,
  LayoutDashboard,
  Database,
  PieChart,
  AlertTriangle,
  FileText,
} from "lucide-react";
import { useAppStore } from "@/stores/appStore";

const navItems = [
  { path: "/", label: "工作台", icon: LayoutDashboard },
  { path: "/data", label: "数据管理", icon: Database },
  { path: "/allocation", label: "预算分配", icon: PieChart },
  { path: "/exceptions", label: "异常中心", icon: AlertTriangle },
  { path: "/reports", label: "报告中心", icon: FileText },
];

export default function Sidebar() {
  const location = useLocation();
  const exceptions = useAppStore((s) => s.exceptions);
  const openCount = exceptions.filter(
    (e) => e.status === "open" || e.status === "in_progress"
  ).length;

  return (
    <aside className="w-60 h-screen fixed left-0 top-0 bg-white border-r border-zinc-200 flex flex-col">
      <div className="px-5 py-5 border-b border-zinc-100 flex items-center gap-2.5">
        <BarChart3 className="w-6 h-6 text-primary-600" />
        <span className="text-lg font-semibold text-zinc-900">预算分配</span>
      </div>

      <nav className="flex-1 py-3 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary-600 text-white"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              }`}
            >
              <Icon className="w-4.5 h-4.5" />
              <span>{item.label}</span>
              {item.path === "/exceptions" && openCount > 0 && (
                <span
                  className={`ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-semibold ${
                    isActive
                      ? "bg-white/20 text-white"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {openCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
