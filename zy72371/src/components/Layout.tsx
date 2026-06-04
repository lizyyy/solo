import { Link, useLocation } from 'react-router-dom';
import { Home, Thermometer, History, Table } from 'lucide-react';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();

  const navItems = [
    { path: '/', label: '数据导入', icon: Home },
    { path: '/threshold', label: '安全阈值表', icon: Table },
    { path: '/history', label: '历史记录', icon: History }
  ];

  return (
    <div className="min-h-screen bg-neutral-100">
      <header className="bg-white border-b border-neutral-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <Thermometer className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-neutral-700">陶瓷窑炉升温曲线</h1>
                <p className="text-sm text-neutral-400">演示系统</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-neutral-500">
              <span className="px-3 py-1 bg-neutral-100 rounded-full">质检员小白</span>
            </div>
          </div>
        </div>
      </header>

      <nav className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`
                    flex items-center gap-2 px-5 py-3 text-sm font-medium transition-all
                    ${isActive 
                      ? 'text-primary border-b-2 border-primary bg-primary/5' 
                      : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {children}
      </main>

      <footer className="bg-white border-t border-neutral-200 mt-auto">
        <div className="max-w-7xl mx-auto px-6 py-4 text-center text-sm text-neutral-400">
          陶瓷窑炉升温曲线演示系统 · 用于培训和流程演示
        </div>
      </footer>
    </div>
  );
};

export default Layout;
