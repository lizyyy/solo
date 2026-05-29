import React from 'react';
import { NavLink } from 'react-router-dom';
import { Search, ListTodo, BarChart3, FileText, Music2 } from 'lucide-react';

const Sidebar: React.FC = () => {
  const navItems = [
    { path: '/', icon: Search, label: '检索工作台' },
    { path: '/records', icon: ListTodo, label: '记录中心' },
    { path: '/analysis', icon: BarChart3, label: '分析面板' },
    { path: '/report', icon: FileText, label: '报告导出' },
  ];

  return (
    <aside className="w-56 bg-slate-900/80 border-r border-slate-700 flex flex-col h-full">
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <Music2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-display text-lg font-bold text-white">旋律检索</h1>
            <p className="text-xs text-slate-400">Melody Finder</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${
                isActive
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`
            }
          >
            <item.icon className="w-4 h-4" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-700">
        <div className="text-xs text-slate-500 space-y-1">
          <p>作品库: 6 首</p>
          <p>检索记录: 0 条</p>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
