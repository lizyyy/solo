import { Outlet, useLocation } from "react-router-dom";
import { Bell, User } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";

const breadcrumbMap: Record<string, string> = {
  "/": "仪表盘",
  "/records": "巡检记录",
  "/import": "数据导入",
  "/review": "飞行复盘",
};

function Breadcrumbs() {
  const location = useLocation();
  const segments = location.pathname.split("/").filter(Boolean);

  if (segments.length === 0) {
    return (
      <nav className="flex items-center text-sm">
        <span className="text-gray-500">首页</span>
        <span className="mx-2 text-gray-300">/</span>
        <span className="text-primary font-medium">仪表盘</span>
      </nav>
    );
  }

  return (
    <nav className="flex items-center text-sm">
      <span className="text-gray-500">首页</span>
      {segments.map((seg, i) => {
        const path = "/" + segments.slice(0, i + 1).join("/");
        const label = breadcrumbMap[path] || seg;
        const isLast = i === segments.length - 1;
        return (
          <span key={path} className="flex items-center">
            <span className="mx-2 text-gray-300">/</span>
            <span className={isLast ? "text-primary font-medium" : "text-gray-500"}>{label}</span>
          </span>
        );
      })}
    </nav>
  );
}

export default function Layout() {
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const unreadCount = useAppStore((s) => s.unreadCount());

  return (
    <div className="min-h-screen bg-surface">
      <Sidebar />

      <div
        className={cn(
          "transition-all duration-200",
          collapsed ? "ml-16" : "ml-sidebar"
        )}
      >
        <header className="h-header sticky top-0 z-20 bg-white border-b border-gray-100 flex items-center justify-between px-6">
          <Breadcrumbs />

          <div className="flex items-center gap-4">
            <button className="relative p-2 rounded-md hover:bg-gray-50 transition-colors">
              <Bell className="w-5 h-5 text-gray-500" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            <div className="flex items-center gap-2 pl-4 border-l border-gray-100">
              <div className="w-8 h-8 rounded-full bg-steel/10 flex items-center justify-center">
                <User className="w-4 h-4 text-steel" />
              </div>
              <span className="text-sm font-medium text-primary">巡检员A</span>
            </div>
          </div>
        </header>

        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
