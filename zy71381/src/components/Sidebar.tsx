import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Package,
  ShieldCheck,
  FileText,
  FileCheck,
  Settings,
  Scale,
} from 'lucide-react';

const navItems = [
  { path: '/', icon: Package, label: '依赖管理' },
  { path: '/review', icon: ShieldCheck, label: '许可证审查' },
  { path: '/waiver', icon: FileText, label: '豁免管理' },
  { path: '/report', icon: FileCheck, label: '合规报告' },
  { path: '/config', icon: Settings, label: '系统配置' },
];

export function Sidebar() {
  return (
    <aside className="w-64 bg-white border-r border-slate-200 h-screen flex flex-col sticky top-0">
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary-600 flex items-center justify-center">
            <Scale className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-serif text-lg font-bold text-slate-900">
              许可证墙
            </h1>
            <p className="text-xs text-slate-500">开源依赖合规审查</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto scrollbar-thin">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `sidebar-item ${isActive ? 'sidebar-item-active' : ''}`
            }
          >
            <item.icon className="w-5 h-5" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-200">
        <div className="text-xs text-slate-500">
          <p>数据存储于浏览器本地</p>
          <p className="mt-1">重启后历史记录可追溯</p>
        </div>
      </div>
    </aside>
  );
}
