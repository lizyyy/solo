import { NavLink, useNavigate } from "react-router-dom";
import {
  Upload,
  SearchCheck,
  PenTool,
  History,
  FileDown,
  Box,
  User,
  ChevronRight,
  HelpCircle,
  ExternalLink,
} from "lucide-react";
import { useAppStore } from "@/store";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/import", label: "导入", icon: Upload },
  { path: "/review", label: "复核", icon: SearchCheck },
  { path: "/correction", label: "修正", icon: PenTool },
  { path: "/history", label: "历史", icon: History },
  { path: "/export", label: "导出", icon: FileDown },
  { path: "/visualization", label: "3D 可视化", icon: Box },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { currentUserId, users, getCurrentUser } = useAppStore();
  const currentUser = getCurrentUser();
  const pendingCount = useAppStore((s) => s.records.filter((r) => r.status === "pending").length);

  const handleUserClick = () => {
    navigate("/user-setup");
  };

  return (
    <div className="flex h-full min-h-screen bg-lab-bg text-lab-text">
      <aside className="w-56 border-r border-lab-bgLighter bg-lab-bgLight flex flex-col">
        <div className="p-4 border-b border-lab-bgLighter">
          <h1 className="text-lg font-bold text-lab-accent flex items-center gap-2">
            <Box className="w-5 h-5" />
            透镜成像误差
          </h1>
          <p className="text-xs text-lab-textMuted mt-1">v1.0.0</p>
        </div>

        <nav className="flex-1 py-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-4 py-3 text-sm transition-colors relative group",
                    isActive
                      ? "text-lab-accent bg-lab-accent/10"
                      : "text-lab-textMuted hover:text-lab-text hover:bg-lab-bgLighter/50"
                  )
                }
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
                {item.path === "/review" && pendingCount > 0 && (
                  <span className="ml-auto bg-lab-danger text-white text-xs px-1.5 py-0.5 rounded-full">
                    {pendingCount}
                  </span>
                )}
                <ChevronRight
                  className={cn(
                    "w-3 h-3 ml-auto opacity-0 transition-opacity",
                    "group-hover:opacity-50"
                  )}
                />
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-lab-bgLighter">
          {currentUser ? (
            <button
              onClick={handleUserClick}
              className="w-full flex items-center gap-3 p-2 rounded hover:bg-lab-bgLighter/50 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-full bg-lab-accent/20 flex items-center justify-center">
                <User className="w-4 h-4 text-lab-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{currentUser.name}</p>
                <p className="text-xs text-lab-textMuted">
                  {currentUser.role === "assistant" ? "实验室助教" : "任课教师"}
                </p>
              </div>
            </button>
          ) : (
            <button
              onClick={handleUserClick}
              className="w-full btn-primary text-sm"
            >
              设置操作人
            </button>
          )}
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 border-b border-lab-bgLighter bg-lab-bgLight/50 flex items-center px-6">
          <div className="flex-1" />
          <button
            onClick={() => window.open("/guide", "_blank")}
            className="flex items-center gap-2 text-sm text-lab-textMuted hover:text-lab-accent transition-colors mr-4"
            title="打开使用指南"
          >
            <HelpCircle className="w-4 h-4" />
            <span className="hidden sm:inline">使用指南</span>
            <ExternalLink className="w-3 h-3" />
          </button>
          {pendingCount > 0 && (
            <div className="flex items-center gap-2 text-sm text-lab-accent">
              <span className="w-2 h-2 rounded-full bg-lab-accent animate-pulse" />
              {pendingCount} 条待处理记录
            </div>
          )}
        </header>

        <div className="flex-1 overflow-auto p-6">{children}</div>
      </main>
    </div>
  );
}
