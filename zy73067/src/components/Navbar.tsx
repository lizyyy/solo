import { NavLink, Link } from "react-router-dom";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Flame,
  FileDown,
  Handshake,
  Wind,
  User,
  Bell,
} from "lucide-react";

const navLinks = [
  { to: "/workbench", label: "复核工作台", icon: LayoutDashboard },
  { to: "/field-mapping", label: "字段映射", icon: ArrowLeftRight },
  { to: "/temp-adjustment", label: "临时阈值调整", icon: Flame },
  { to: "/export", label: "导出中心", icon: FileDown },
  { to: "/handover", label: "交接面板", icon: Handshake },
];

export default function Navbar() {
  return (
    <header className="sticky top-0 z-30 bg-industrial-600 text-white shadow-lg shadow-industrial-900/20 border-b border-industrial-700">
      <div className="px-6 h-16 flex items-center justify-between">
        <Link to="/workbench" className="flex items-center gap-3">
          <div className="p-2 bg-industrial-500 rounded-industrial">
            <Wind size={22} strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-wide leading-tight">
              风机叶片阈值预警系统
            </h1>
            <p className="text-[10px] text-industrial-200 leading-tight">
              Blade Threshold Alert Review
            </p>
          </div>
        </Link>

        <nav className="flex items-center h-full">
          {navLinks.map((link) => {
            const Icon = link.icon;
            return (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `relative h-full px-4 flex items-center gap-2 text-sm font-medium transition-all
                    ${
                      isActive
                        ? "text-white"
                        : "text-industrial-200 hover:text-white hover:bg-industrial-500/40"
                    }`
                }
                end={link.to === "/workbench"}
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />
                    )}
                    <Icon size={16} strokeWidth={2} />
                    <span>{link.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <button
            className="relative p-2 rounded-industrial hover:bg-industrial-500/40 transition-colors"
            title="通知"
          >
            <Bell size={18} strokeWidth={2} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-alert-400 rounded-full border border-industrial-600" />
          </button>
          <div className="flex items-center gap-2 pl-3 border-l border-industrial-500/60">
            <div className="w-8 h-8 rounded-full bg-industrial-400 border border-industrial-300 flex items-center justify-center">
              <User size={14} strokeWidth={2} />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold">阿敏</p>
              <p className="text-[10px] text-industrial-200">维保主管</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
