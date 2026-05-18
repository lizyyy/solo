import { Link, useLocation } from 'react-router-dom';
import { FileText, PlusCircle, BarChart3, Coffee } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();

  const navItems = [
    { path: '/', label: '扣分记录', icon: FileText },
    { path: '/create', label: '新增扣分', icon: PlusCircle },
    { path: '/reports', label: '数据报表', icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 bg-gradient-to-b from-teal-800 to-teal-900 text-white flex flex-col">
        <div className="p-6 border-b border-teal-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-600 rounded-lg flex items-center justify-center">
              <Coffee className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-lg">茶饮巡店系统</h1>
              <p className="text-teal-300 text-sm">扣分管理平台</p>
            </div>
          </div>
        </div>
        
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path || 
                (item.path === '/' && location.pathname === '/') ||
                (item.path === '/create' && location.pathname.startsWith('/edit'));
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                      isActive
                        ? 'bg-teal-600 text-white shadow-lg'
                        : 'text-teal-100 hover:bg-teal-700 hover:text-white'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        
        <div className="p-4 border-t border-teal-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-600 rounded-full flex items-center justify-center">
              <span className="font-bold">管</span>
            </div>
            <div>
              <p className="font-medium text-sm">管理员</p>
              <p className="text-teal-300 text-xs">admin@teashop.com</p>
            </div>
          </div>
        </div>
      </aside>
      
      <main className="flex-1 bg-gray-50">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
};

export default Layout;
