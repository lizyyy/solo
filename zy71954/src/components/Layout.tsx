import { useEffect } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  BatteryCharging,
  LayoutDashboard,
  Upload,
  Download,
  User,
} from "lucide-react";
import { useAppStore } from "@/store";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "换电总览" },
  { to: "/import", icon: Upload, label: "数据导入" },
  { to: "/export", icon: Download, label: "筛选导出" },
];

let dataLoaded = false;

export default function Layout() {
  const { sorties, loadAllData, loadMockData } = useAppStore();

  useEffect(() => {
    if (dataLoaded) return;
    dataLoaded = true;
    const init = async () => {
      await loadAllData();
      const currentSorties = useAppStore.getState().sorties;
      if (currentSorties.length === 0) {
        await loadMockData();
      }
    };
    init();
  }, []);

  return (
    <div className="flex min-w-[1280px] bg-[#1a1a2e] text-gray-200">
      <aside className="fixed left-0 top-0 z-40 flex h-screen w-60 flex-col bg-[#16213e]">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <BatteryCharging className="h-6 w-6 text-amber-400" />
          <span className="font-mono text-lg font-bold tracking-wide text-amber-400">
            换电巡检系统
          </span>
        </div>

        <nav className="mt-2 flex-1 space-y-1 px-3">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200 ${
                  isActive
                    ? "bg-amber-400/10 text-amber-400"
                    : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                }`
              }
            >
              <Icon className="h-[18px] w-[18px]" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/10 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <User className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-500">外场队长</span>
          </div>
        </div>
      </aside>

      <main className="ml-60 min-h-screen flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
