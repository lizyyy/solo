import { NavLink } from 'react-router-dom';
import { Droplets, GitCompare, ClipboardList, Clock, Anchor } from 'lucide-react';

const navItems = [
  { path: '/', label: '数据清洗工作台', icon: Droplets },
  { path: '/compare', label: '参数对比面板', icon: GitCompare },
  { path: '/review', label: '月度复核视图', icon: ClipboardList },
  { path: '/handover', label: '交接时间线', icon: Clock },
];

export default function Sidebar() {
  return (
    <aside className="w-64 bg-ocean-900 border-r border-ocean-700 flex flex-col h-screen sticky top-0">
      <div className="p-6 border-b border-ocean-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-nautical-warning/20 rounded-lg flex items-center justify-center">
            <Anchor className="w-6 h-6 text-nautical-warning" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">近岸水质</h1>
            <p className="text-xs text-ocean-400">数据清洗工作台</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                isActive
                  ? 'bg-ocean-700 text-white shadow-inner-ocean border-l-4 border-nautical-warning'
                  : 'text-ocean-300 hover:bg-ocean-800 hover:text-white border-l-4 border-transparent'
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            <span className="text-sm font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-ocean-700">
        <div className="bg-ocean-800 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-ocean-600 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-bold">何</span>
            </div>
            <div>
              <p className="text-sm text-white font-medium">老何</p>
              <p className="text-xs text-ocean-400">港口工程师</p>
            </div>
          </div>
          <div className="text-xs text-ocean-400 mt-2 pt-2 border-t border-ocean-700">
            <p>今日待处理：<span className="text-nautical-warning font-medium">3</span> 条</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
