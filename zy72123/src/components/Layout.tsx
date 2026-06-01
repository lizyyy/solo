import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Database, Gauge, AlertTriangle, GitCompare, Download } from 'lucide-react';

const navItems = [
  { to: '/import', icon: Database, label: '数据导入' },
  { to: '/workspace', icon: Gauge, label: '估算工作台' },
  { to: '/review', icon: AlertTriangle, label: '冲突与异常' },
  { to: '/compare', icon: GitCompare, label: '历史对比' },
  { to: '/export', icon: Download, label: '导出与交接' },
];

export default function Layout() {
  return (
    <div className="flex h-screen bg-[var(--color-bg)]">
      <nav className="w-56 bg-brand-500 text-white flex flex-col shrink-0">
        <div className="px-5 py-6 border-b border-white/10">
          <h1 className="text-base font-semibold tracking-wide">EV 再生制动估算</h1>
          <p className="text-xs text-white/50 mt-1">Regen Braking Estimator</p>
        </div>
        <div className="flex-1 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-5 py-3 text-sm transition-colors ${
                  isActive
                    ? 'bg-white/15 text-white font-medium'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </div>
        <div className="px-5 py-4 border-t border-white/10 text-xs text-white/40">
          v1.0 · 实验记录本数字化
        </div>
      </nav>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
