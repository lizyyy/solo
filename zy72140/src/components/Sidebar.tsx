import { useState } from "react";
import { NavLink } from "react-router-dom";
import { Music, CalendarCheck, FolderOpen, Upload, ClipboardList } from "lucide-react";

const navItems = [
  { to: "/", icon: CalendarCheck, label: "排班总览" },
  { to: "/materials", icon: FolderOpen, label: "材料管理" },
  { to: "/import", icon: Upload, label: "批量导入" },
  { to: "/audit-log", icon: ClipboardList, label: "处理日志" },
];

export default function Sidebar() {
  const [expanded, setExpanded] = useState(false);

  return (
    <aside
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      className={`
        hidden md:flex flex-col h-screen bg-slate-800 text-white
        transition-all duration-300 ease-in-out overflow-hidden
        ${expanded ? "w-60" : "w-16"}
      `}
    >
      <div className="flex items-center gap-3 px-4 h-16 border-b border-slate-700 shrink-0">
        <Music className="w-7 h-7 text-amber-500 shrink-0" />
        <span
          className={`
            text-lg font-semibold whitespace-nowrap transition-opacity duration-300
            ${expanded ? "opacity-100" : "opacity-0"}
          `}
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          音乐节排班
        </span>
      </div>

      <nav className="flex-1 py-4 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) => `
              flex items-center gap-3 px-4 h-11 transition-colors duration-200
              ${isActive
                ? "border-l-4 border-amber-500 bg-amber-500/10 text-amber-400"
                : "border-l-4 border-transparent text-slate-400 hover:text-white hover:bg-slate-700/50"
              }
            `}
          >
            <Icon className="w-5 h-5 shrink-0" />
            <span
              className={`whitespace-nowrap transition-opacity duration-300 ${expanded ? "opacity-100" : "opacity-0"}`}
            >
              {label}
            </span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
