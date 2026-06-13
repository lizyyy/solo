import { NavLink } from 'react-router-dom';
import { Upload, CheckSquare, AlertTriangle, FilePlus, FileCheck } from 'lucide-react';

const menuItems = [
  { path: '/import', label: '灰度批次导入', icon: Upload },
  { path: '/review', label: '审核工作区', icon: CheckSquare },
  { path: '/conflicts', label: '冲突处理', icon: AlertTriangle },
  { path: '/supplement', label: '补录与重算', icon: FilePlus },
  { path: '/selfcheck', label: '导出与自检', icon: FileCheck },
];

export default function Sidebar() {
  return (
    <aside className="w-56 bg-slate-900 border-r border-white/10 min-h-screen">
      <div className="p-5 border-b border-white/10">
        <h1 className="text-lg font-semibold text-white">审核控制台</h1>
        <p className="text-xs text-slate-400 mt-1">Gray Review System</p>
      </div>
      <nav className="p-2">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm font-medium transition-colors mb-1 ${
                isActive
                  ? 'bg-white/10 text-white'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`
            }
          >
            <item.icon size={16} />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
