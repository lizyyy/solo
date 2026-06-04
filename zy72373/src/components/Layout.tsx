import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Wind, Home, Play } from 'lucide-react';
import { useDiagnosisStore } from '../store/useDiagnosisStore';

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { loadDemoData, isDemoMode } = useDiagnosisStore();

  const navItems = [
    { path: '/', label: '诊断看板', icon: Home },
    { path: '/demo', label: '教学演示', icon: Play },
  ];

  const handleDemoClick = () => {
    loadDemoData();
    navigate('/demo');
  };

  return (
    <div className="min-h-screen bg-industrial-50">
      <header className="bg-industrial-800 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="bg-alert-orange p-2 rounded-lg">
                <Wind className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-lg font-bold">风扇叶片平衡诊断系统</h1>
                <p className="text-xs text-industrial-300">Fan Blade Balance Diagnosis</p>
              </div>
            </div>
            
            <nav className="flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                
                return (
                  <button
                    key={item.path}
                    onClick={() => item.path === '/demo' ? handleDemoClick() : navigate(item.path)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 ${
                      isActive
                        ? 'bg-industrial-700 text-white'
                        : 'text-industrial-200 hover:bg-industrial-700 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm font-medium">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      <footer className="bg-industrial-100 border-t border-industrial-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between text-sm text-industrial-500">
            <span>© 2026 风扇叶片平衡诊断系统</span>
            <div className="flex items-center gap-4">
              {isDemoMode && (
                <span className="bg-alert-orange/10 text-alert-orange px-2 py-1 rounded text-xs">
                  演示模式
                </span>
              )}
              <span>训练教练老唐 · 教学专用</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
