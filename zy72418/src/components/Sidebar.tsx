import { NavLink } from "react-router-dom";
import {
  Upload,
  AlertTriangle,
  Table,
  History,
  ShieldCheck,
  UserPlus,
  FileSpreadsheet,
} from "lucide-react";
import { useAppStore } from "@/store/appStore";

const navItems = [
  { path: "/", label: "导入预览", icon: Upload, end: true },
  { path: "/conflicts", label: "冲突处理", icon: AlertTriangle, badge: "conflicts" },
  { path: "/results", label: "结果展示", icon: Table },
  { path: "/audit", label: "审计追踪", icon: History },
  { path: "/self-check", label: "自检报告", icon: ShieldCheck },
];

interface SidebarProps {
  pendingConflicts: number;
  pendingReview: number;
}

export default function Sidebar({ pendingConflicts, pendingReview }: SidebarProps) {
  const { currentUser } = useAppStore();

  return (
    <aside className="w-64 bg-white border-r border-gray-200 min-h-screen flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-xl font-bold text-primary-800 font-serif">
          音乐治疗课
          <br />
          <span className="text-primary-600">反馈归并系统</span>
        </h1>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
                isActive
                  ? "bg-primary-50 text-primary-700 font-medium"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  size={18}
                  className={
                    isActive ? "text-primary-600" : "text-gray-400 group-hover:text-gray-600"
                  }
                />
                <span>{item.label}</span>
                {item.badge === "conflicts" && pendingConflicts > 0 && (
                  <span className="ml-auto bg-danger-500 text-white text-xs px-2 py-0.5 rounded-full animate-pulse-soft">
                    {pendingConflicts}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {pendingReview > 0 && (
        <div className="mx-4 mb-4 p-4 bg-warning-50 border border-warning-200 rounded-lg">
          <div className="flex items-center gap-2 text-warning-700 mb-2">
            <UserPlus size={16} />
            <span className="text-sm font-medium">待票务复核</span>
          </div>
          <p className="text-xs text-warning-600">
            有 <span className="font-bold">{pendingReview}</span> 条临时替补记录等待复核
          </p>
        </div>
      )}

      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-medium">
            {currentUser.name.charAt(0)}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">{currentUser.name}</p>
            <p className="text-xs text-gray-500">
              {currentUser.role === "coordinator" && "巡演统筹"}
              {currentUser.role === "ticket" && "票务同事"}
              {currentUser.role === "finance" && "财务同事"}
              {currentUser.role === "admin" && "系统管理员"}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
