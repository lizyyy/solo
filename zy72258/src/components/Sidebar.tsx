import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FileSpreadsheet,
  ShieldCheck,
  Workflow,
  History,
  User,
} from 'lucide-react';
import { useCanonicalStore } from '../store/canonicalStore';

const navItems = [
  { path: '/overview', label: '标注总览', icon: LayoutDashboard },
  { path: '/coordinate-origin', label: '坐标原点说明', icon: FileSpreadsheet },
  { path: '/self-check', label: '自检中心', icon: ShieldCheck },
  { path: '/workflow', label: '三步流程', icon: Workflow },
  { path: '/audit-log', label: '复盘记录', icon: History },
];

export function Sidebar() {
  const { currentOperator, setOperator } = useCanonicalStore();

  return (
    <aside className="w-60 bg-gray-50 border-r-2 border-gray-200 flex flex-col h-screen fixed left-0 top-0">
      <div className="p-4 border-b-2 border-gray-200 bg-primary-600">
        <h1 className="text-lg font-bold text-white">桥梁裂缝三维标注</h1>
        <p className="text-xs text-primary-100 mt-1">数据一致性管控系统</p>
      </div>

      <nav className="flex-1 py-4 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `sidebar-nav-item ${isActive ? 'sidebar-nav-item-active' : ''}`
            }
          >
            <item.icon className="w-5 h-5 mr-3" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t-2 border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <User className="w-5 h-5 text-gray-500 mr-2" />
            <span className="text-sm font-medium text-gray-700">{currentOperator}</span>
          </div>
          <select
            value={currentOperator}
            onChange={(e) => setOperator(e.target.value as '许工' | '安全员')}
            className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-primary-600"
          >
            <option value="许工">许工</option>
            <option value="安全员">安全员</option>
          </select>
        </div>
      </div>
    </aside>
  );
}
