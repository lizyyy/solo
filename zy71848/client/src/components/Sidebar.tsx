import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Eye, Layers, FileDown, Settings, MapPin } from 'lucide-react';

const navItems = [
  { path: '/', label: '检查工作台', icon: LayoutDashboard },
  { path: '/batch', label: '批量处理', icon: Layers },
  { path: '/export', label: '导出管理', icon: FileDown },
  { path: '/settings', label: '系统配置', icon: Settings },
];

export default function Sidebar() {
  return (
    <aside className="w-64 bg-slate-900 text-white min-h-screen flex flex-col">
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-600 rounded flex items-center justify-center">
            <MapPin size={20} />
          </div>
          <div>
            <h1 className="font-bold text-lg">停车楼坡道检查</h1>
            <p className="text-xs text-slate-400">Parking Ramp Inspection</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded border-2 transition-all ${
                      isActive
                        ? 'bg-primary-600 border-primary-500 text-white shadow-md transform translate-y-0.5'
                        : 'border-transparent text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`
                  }
                >
                  <Icon size={18} />
                  <span className="text-sm font-medium">{item.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-slate-700">
        <div className="bg-slate-800 rounded-lg p-4">
          <p className="text-xs text-slate-400 mb-1">操作指南</p>
          <ul className="text-xs text-slate-500 space-y-1">
            <li>• 工作台：查看所有检查记录</li>
            <li>• 批量处理：幂等执行，避免重复</li>
            <li>• 导出前：执行一致性复核</li>
          </ul>
        </div>
      </div>
    </aside>
  );
}
