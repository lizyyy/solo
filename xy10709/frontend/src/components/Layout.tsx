import { Link, Outlet, useLocation } from 'react-router-dom';

export default function Layout() {
  const location = useLocation();
  
  const navItems = [
    { path: '/', label: '仪表盘', icon: '📊' },
    { path: '/uploads', label: '上传任务', icon: '📁' },
    { path: '/security-logs', label: '安全日志', icon: '🔒' },
    { path: '/organizations', label: '组织管理', icon: '🏢' },
    { path: '/scan-rules', label: '扫描规则', icon: '📋' },
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-blue-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-2">
              <span className="text-2xl">🔐</span>
              <h1 className="text-xl font-bold">文件上传扫描流水线</h1>
            </div>
            <div className="flex space-x-1">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-4 py-2 rounded-md transition-colors ${
                    location.pathname === item.path
                      ? 'bg-blue-700 text-white'
                      : 'text-blue-100 hover:bg-blue-500'
                  }`}
                >
                  <span className="mr-2">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
