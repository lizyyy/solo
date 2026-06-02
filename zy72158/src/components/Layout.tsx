import { ReactNode, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FileUp, 
  MapPin, 
  FileText, 
  Menu, 
  X,
  Building2
} from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

const navItems = [
  { path: '/', label: '审批工作台', icon: LayoutDashboard },
  { path: '/import', label: '数据导入', icon: FileUp },
  { path: '/map', label: '地图标注', icon: MapPin },
  { path: '/export', label: '报告导出', icon: FileText },
];

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside 
        className={`${
          sidebarOpen ? 'w-64' : 'w-16'
        } bg-primary-700 text-white transition-all duration-300 flex flex-col`}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-primary-600">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <Building2 className="w-6 h-6" />
              <span className="font-bold text-lg">商业街外摆审批</span>
            </div>
          )}
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-primary-600 rounded transition-colors"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
        
        <nav className="flex-1 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 transition-colors ${
                  isActive 
                    ? 'bg-primary-500 text-white' 
                    : 'text-primary-100 hover:bg-primary-600'
                }`
              }
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {sidebarOpen && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>
        
        {sidebarOpen && (
          <div className="p-4 border-t border-primary-600 text-sm text-primary-200">
            <p>当前用户：市政设计师 老曹</p>
            <p className="text-xs mt-1 opacity-70">数据已自动保存至本地</p>
          </div>
        )}
      </aside>
      
      <main className="flex-1 flex flex-col min-h-screen">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center px-6 shadow-sm">
          <h1 className="text-xl font-semibold text-gray-800">
            商业街外摆审批管理系统
          </h1>
        </header>
        
        <div className="flex-1 p-6 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
