import { NavLink, useLocation } from 'react-router-dom';
import { Shield, AlertTriangle, Clock, FileText, Server } from 'lucide-react';

const navItems = [
  { to: '/', label: '核验工作台', icon: Shield },
  { to: '/issues', label: '问题清单', icon: AlertTriangle },
  { to: '/history', label: '历史对比', icon: Clock },
  { to: '/report', label: '报告导出', icon: FileText },
];

export default function Sidebar() {
  const location = useLocation();

  return (
    <aside className="fixed left-0 top-0 h-screen w-56 bg-navy-800 border-r border-navy-500/30 flex flex-col z-50">
      <div className="px-5 py-6 border-b border-navy-500/30">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-cyan to-accent-blue flex items-center justify-center">
            <Server className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white leading-tight">备份核验</h1>
            <p className="text-[10px] text-slate-500">Backup Verify</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-1">
        {navItems.map(({ to, label, icon: Icon }) => {
          const isActive = location.pathname === to;
          return (
            <NavLink
              key={to}
              to={to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${
                isActive
                  ? 'bg-accent-cyan/10 text-accent-cyan glow-cyan'
                  : 'text-slate-400 hover:bg-navy-600/50 hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-navy-500/30">
        <p className="text-[10px] text-slate-600 text-center">v1.0 · 本地备份核验系统</p>
      </div>
    </aside>
  );
}
