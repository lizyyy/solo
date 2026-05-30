import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FileUp, 
  Clock, 
  CheckSquare, 
  Archive, 
  Scale 
} from 'lucide-react';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: '仪表盘' },
  { path: '/import', icon: FileUp, label: '材料导入' },
  { path: '/evidence', icon: Clock, label: '证据链' },
  { path: '/review', icon: CheckSquare, label: '复核清单' },
  { path: '/archive', icon: Archive, label: '已归档' },
];

export function Sidebar() {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="w-56 bg-primary-900 text-white min-h-screen flex flex-col">
      <div className="p-6 border-b border-primary-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-600 rounded flex items-center justify-center">
            <Scale className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-serif font-bold text-lg">银企回单</h1>
            <p className="text-xs text-primary-300">重挂管理系统</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded transition-colors ${
                  isActive(item.path)
                    ? 'bg-primary-700 text-white'
                    : 'text-primary-200 hover:bg-primary-800 hover:text-white'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-sm font-medium">{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="p-4 border-t border-primary-700">
        <div className="text-xs text-primary-400 text-center">
          v1.0.0 · 风控运营专用
        </div>
      </div>
    </div>
  );
}
