import { NavLink } from "react-router-dom";
import { Music, CalendarCheck, FolderOpen, Upload, ClipboardList } from "lucide-react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

const navItems = [
  { to: "/", icon: CalendarCheck, label: "排班总览" },
  { to: "/materials", icon: FolderOpen, label: "材料管理" },
  { to: "/import", icon: Upload, label: "批量导入" },
  { to: "/audit-log", icon: ClipboardList, label: "处理日志" },
];

function MobileTopBar() {
  return (
    <header className="md:hidden bg-slate-800 text-white">
      <div className="flex items-center gap-3 px-4 h-14">
        <Music className="w-6 h-6 text-amber-500" />
        <span
          className="text-lg font-semibold"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          音乐节排班
        </span>
      </div>
      <nav className="flex border-t border-slate-700">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-2 text-xs transition-colors duration-200
              ${isActive
                ? "text-amber-400 border-b-2 border-amber-500"
                : "text-slate-400 hover:text-white"
              }`
            }
          >
            <Icon className="w-5 h-5 mb-0.5" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </header>
  );
}

export default function Layout() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <MobileTopBar />
      <main className="flex-1 bg-stone-50 min-h-screen p-6" style={{ fontFamily: "'Noto Sans SC', sans-serif" }}>
        <Outlet />
      </main>
    </div>
  );
}
