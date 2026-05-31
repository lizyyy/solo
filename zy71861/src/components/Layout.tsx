import { Link, useLocation } from 'react-router-dom';
import { Home, List, CheckCircle, FileText } from 'lucide-react';

const Layout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();

  const navItems = [
    { path: '/', label: '材料导入', icon: Home },
    { path: '/overview', label: '回放总览', icon: List },
    { path: '/confirm', label: '人工确认', icon: CheckCircle },
  ];

  return (
    <div className="min-h-screen bg-primary-50">
      <header className="bg-primary-800 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <FileText className="w-8 h-8 text-accent-400" />
              <h1 className="text-2xl font-serif font-bold">几何辅助线回放系统</h1>
            </div>
            <nav className="flex space-x-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 ${
                      isActive
                        ? 'bg-accent-500 text-white shadow-md'
                        : 'text-primary-100 hover:bg-primary-700 hover:text-white'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {children}
      </main>

      <footer className="bg-primary-800 text-primary-200 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm">
          <p>几何辅助线回放系统 &copy; 2024 | 教研工作可追溯，证据链完整保存</p>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
