import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileUp, AlertTriangle, FileText, BookOpen } from 'lucide-react';

const menuItems = [
  { path: '/dashboard', label: '工作台', icon: LayoutDashboard },
  { path: '/import', label: '材料导入', icon: FileUp },
  { path: '/exceptions', label: '异常列表', icon: AlertTriangle },
  { path: '/docs', label: '说明文档', icon: BookOpen }
];

export const Sidebar = () => {
  const location = useLocation();

  return (
    <div className="w-56 bg-[#1e3a5f] min-h-screen flex flex-col">
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-500 rounded-sm flex items-center justify-center">
            <FileText size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-white font-semibold text-sm">敞口穿透预警</h1>
            <p className="text-blue-200 text-xs">场外期权</p>
          </div>
        </div>
      </div>
      
      <nav className="flex-1 py-4">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path || 
                          (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
          
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-5 py-2.5 text-sm transition-colors ${
                isActive 
                  ? 'bg-blue-600/30 text-white border-l-2 border-blue-400' 
                  : 'text-blue-100 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
      
      <div className="p-4 border-t border-white/10">
        <div className="text-blue-200 text-xs">
          <p>当前用户：清算专员</p>
          <p className="mt-1 text-blue-300/70">v1.0.0</p>
        </div>
      </div>
    </div>
  );
};
