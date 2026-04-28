import { Link, useLocation, Outlet } from 'react-router-dom';

const Layout = () => {
  const location = useLocation();

  const navItems = [
    { path: '/', icon: '🏠', label: '图鉴' },
    { path: '/creations', icon: '🎨', label: '工坊' },
    { path: '/defects', icon: '⚠️', label: '瑕疵档案' },
    { path: '/messages', icon: '💬', label: '树洞' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-soft to-white">
      <header className="sticky top-0 z-50 glass border-b border-white/50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-2xl animate-float">🏭</span>
            <h1 className="text-lg font-bold gradient-text">小小制造工厂</h1>
          </Link>
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  location.pathname === item.path
                    ? 'bg-primary/10 text-primary'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span className="mr-1">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 glass border-t border-white/50 md:hidden">
        <div className="flex justify-around py-2">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center px-4 py-2 ${
                location.pathname === item.path
                  ? 'text-primary'
                  : 'text-gray-500'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-xs mt-1">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>

      <div className="h-16 md:h-0" />
    </div>
  );
};

export default Layout;