import {
  Users,
  CalendarCheck,
  CalendarX,
  Star,
  Download,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "../lib/utils";

const navItems = [
  { path: "/", label: "学生名册", icon: Users },
  { path: "/checkin", label: "打卡记录", icon: CalendarCheck },
  { path: "/leave", label: "请假补练", icon: CalendarX },
  { path: "/rewards", label: "奖励星榜", icon: Star },
  { path: "/export", label: "数据导出", icon: Download },
];

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen bg-gray-50 font-body">
      <div className="flex">
        <aside
          className={cn(
            "fixed lg:static inset-y-0 left-0 z-50 bg-secondary text-white transition-all duration-300",
            sidebarOpen ? "w-64" : "w-0 lg:w-20"
          )}
        >
          <div className="h-full flex flex-col">
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center justify-between">
                <div
                  className={cn(
                    "transition-opacity",
                    !sidebarOpen && "lg:opacity-0"
                  )}
                >
                  <h1 className="font-display text-xl text-gold">🎹 练琴奖励账本</h1>
                </div>
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="lg:hidden p-1 hover:bg-white/10 rounded"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <nav className="flex-1 py-4">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "flex items-center gap-3 px-6 py-3 transition-all",
                      isActive
                        ? "bg-gold/20 text-gold border-r-4 border-gold"
                        : "text-white/70 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <Icon size={20} />
                    <span
                      className={cn(
                        "whitespace-nowrap transition-opacity",
                        !sidebarOpen && "lg:hidden"
                      )}
                    >
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </nav>

            <div className="p-4 border-t border-white/10">
              <div
                className={cn(
                  "text-xs text-white/50 transition-opacity",
                  !sidebarOpen && "lg:hidden"
                )}
              >
                <p>打卡归集：时长×每分钟星数</p>
                <p>请假扣分：独立记录不合并</p>
                <p>补练返还：一条请假仅一次</p>
              </div>
            </div>
          </div>
        </aside>

        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="fixed top-4 left-4 z-40 lg:hidden p-2 bg-secondary text-white rounded-lg shadow-lg"
          >
            <Menu size={20} />
          </button>
        )}

        <main className="flex-1 min-h-screen">
          <div className="p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
