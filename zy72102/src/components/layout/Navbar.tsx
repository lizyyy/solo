import React from 'react';
import { NavLink } from 'react-router-dom';
import { Mountain, Upload, BarChart3, FileText, History } from 'lucide-react';
import { cn } from '../../lib/utils';

const navItems = [
  { path: '/', label: '分析仪表板', icon: BarChart3 },
  { path: '/import', label: '数据导入', icon: Upload },
  { path: '/report', label: '报告导出', icon: FileText },
  { path: '/history', label: '历史对比', icon: History },
];

export function Navbar() {
  return (
    <nav className="bg-slate-900/80 backdrop-blur-lg border-b border-slate-700/50">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 p-2">
              <Mountain className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">滑雪坡道能量分析</h1>
              <p className="text-xs text-slate-400">设备工程师 · 何工专用</p>
            </div>
          </div>

          <div className="flex items-center space-x-1">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  cn(
                    'flex items-center space-x-2 rounded-lg px-4 py-2 text-sm font-medium transition-all',
                    isActive
                      ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/20'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
