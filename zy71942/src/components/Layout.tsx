import { NavLink, Outlet } from "react-router-dom";
import { Satellite, LayoutDashboard, Upload, AlertTriangle, GitCompare, X } from "lucide-react";
import { useStore } from "@/store/useStore";

const NAV_ITEMS = [
  { label: "冲突总览", icon: LayoutDashboard, path: "/" },
  { label: "数据导入", icon: Upload, path: "/import" },
  { label: "冲突检测", icon: AlertTriangle, path: "/conflicts" },
  { label: "版本追踪", icon: GitCompare, path: "/versions" },
];

export default function Layout() {
  const changeAlerts = useStore((s) => s.changeAlerts);
  const duplicateAlert = useStore((s) => s.duplicateAlert);
  const dismissChangeAlert = useStore((s) => s.dismissChangeAlert);
  const confirmDuplicate = useStore((s) => s.confirmDuplicate);
  const dismissDuplicateAlert = useStore((s) => s.dismissDuplicateAlert);

  return (
    <div className="min-h-screen bg-slate-950">
      <aside className="fixed inset-y-0 left-0 w-56 bg-slate-900 border-r border-slate-800 flex flex-col z-30">
        <div className="px-5 py-5 flex items-center gap-2.5 border-b border-slate-800">
          <Satellite className="w-5 h-5 text-amber-500" />
          <span className="text-base font-semibold text-slate-50 tracking-wide">
            地面站资源冲突
          </span>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-slate-800 text-amber-400 border-l-[3px] border-amber-500 pl-[9px]"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border-l-[3px] border-transparent pl-[9px]"
                }`
              }
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-5 py-4 border-t border-slate-800">
          <p className="text-[11px] text-slate-600">地面站资源冲突管理系统 v1.0</p>
        </div>
      </aside>

      <div className="ml-56 min-h-screen flex flex-col">
        {changeAlerts.length > 0 && (
          <div className="bg-amber-500/10 border-b border-amber-500/20">
            {changeAlerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-center justify-between px-6 py-2 text-sm text-amber-300"
              >
                <span>{alert.message}</span>
                <button
                  onClick={() => dismissChangeAlert(alert.id)}
                  className="ml-4 p-0.5 rounded hover:bg-amber-500/20 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <main className="flex-1 p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {duplicateAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-slate-50 mb-3">
              检测到重复计划
            </h3>
            <p className="text-sm text-slate-400 mb-1">
              已存在同名计划：
              <span className="text-slate-200 font-medium">
                {duplicateAlert.existingName}
              </span>
            </p>
            <p className="text-sm text-slate-400 mb-6">
              现有版本：
              <span className="text-amber-400 font-medium">
                {duplicateAlert.existingVersion}
              </span>
            </p>
            <p className="text-sm text-slate-300 mb-6">
              请选择处理方式：
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => confirmDuplicate("keep")}
                className="flex-1 px-4 py-2.5 rounded-md bg-slate-700 text-slate-200 text-sm font-medium hover:bg-slate-600 transition-colors"
              >
                保留
              </button>
              <button
                onClick={() => confirmDuplicate("overwrite")}
                className="flex-1 px-4 py-2.5 rounded-md bg-amber-600 text-white text-sm font-medium hover:bg-amber-500 transition-colors"
              >
                覆盖
              </button>
            </div>
            <button
              onClick={dismissDuplicateAlert}
              className="mt-3 w-full px-4 py-2 rounded-md text-slate-500 text-xs hover:text-slate-300 transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
