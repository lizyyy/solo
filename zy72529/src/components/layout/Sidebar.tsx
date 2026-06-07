import { FileSpreadsheet, Settings, Home } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';

const navItems = [
  { path: '/list', label: '理赔材料识别', icon: FileSpreadsheet },
  { path: '/home', label: '首页', icon: Home },
  { path: '/settings', label: '设置', icon: Settings },
];

export function Sidebar() {
  const location = useLocation();

  return (
    <aside className="w-64 bg-slate-900 text-white min-h-screen flex flex-col">
      <div className="p-5 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center">
            <FileSpreadsheet size={20} />
          </div>
          <div>
            <div className="font-bold text-base">保险理赔识别</div>
            <div className="text-xs text-slate-400">证据追溯系统</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3">
        <div className="space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>

      <div className="p-4 border-t border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm">
            孟
          </div>
          <div>
            <div className="text-sm font-medium">小孟</div>
            <div className="text-xs text-slate-400">模型评测</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
