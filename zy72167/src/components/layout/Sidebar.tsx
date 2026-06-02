import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Upload,
  Merge,
  CheckSquare,
  MapPin,
  FileSpreadsheet,
  PlusCircle,
  Leaf,
} from 'lucide-react';

const navItems = [
  { path: '/', label: '概览仪表盘', icon: LayoutDashboard },
  { path: '/import', label: '数据导入', icon: Upload },
  { path: '/merge', label: '点位归并', icon: Merge },
  { path: '/review', label: '人工复核', icon: CheckSquare },
  { path: '/map', label: '地图标注', icon: MapPin },
  { path: '/export', label: '导出公示', icon: FileSpreadsheet },
  { path: '/supplement', label: '补录备注', icon: PlusCircle },
];

export default function Sidebar() {
  return (
    <aside className="w-64 bg-white border-r border-gray-200 h-screen flex flex-col fixed left-0 top-0 z-20 animate-fade-in">
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-600 rounded-md flex items-center justify-center">
            <Leaf className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-serif font-bold text-lg text-primary-700">低碳街区</h1>
            <p className="text-xs text-gray-500">碳账本管理系统</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 overflow-y-auto">
        <div className="space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `nav-link ${isActive ? 'active' : ''}`
              }
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      <div className="p-4 border-t border-gray-100">
        <div className="text-xs text-gray-500">
          <p className="font-medium text-gray-700 mb-1">操作人员</p>
          <p>周姐（街道工作人员）</p>
        </div>
      </div>
    </aside>
  );
}
