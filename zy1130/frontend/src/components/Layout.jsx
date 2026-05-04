import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FileSpreadsheet, 
  MapPin, 
  GitCompare, 
  FileText, 
  Settings,
  Menu,
  X,
  Truck,
  Clock,
  AlertTriangle
} from 'lucide-react';

const navItems = [
  { path: '/', label: '仪表盘', icon: LayoutDashboard },
  { path: '/import', label: '数据导入', icon: FileSpreadsheet },
  { path: '/plan', label: '路线规划', icon: MapPin },
  { path: '/compare', label: '方案对比', icon: GitCompare },
  { path: '/reports', label: '导出报告', icon: FileText },
  { path: '/settings', label: '设置', icon: Settings }
];

const Layout = ({ children }) => {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [stats, setStats] = React.useState({ jobs: 0, workers: 0 });
  const [health, setHealth] = React.useState(true);

  React.useEffect(() => {
    const loadStats = async () => {
      try {
        const { systemApi } = await import('../utils/api');
        const [healthRes, statsRes] = await Promise.all([
          systemApi.health().catch(() => ({ data: { success: false } })),
          systemApi.stats().catch(() => ({ data: { data: { jobs: 0, workers: 0 } } }))
        ]);
        setHealth(healthRes.data?.success);
        setStats(statsRes.data?.data || { jobs: 0, workers: 0 });
      } catch (e) {
        setHealth(false);
      }
    };
    loadStats();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside 
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-white border-r border-gray-200 transition-all duration-300 flex flex-col`}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <Truck className="w-8 h-8 text-blue-600" />
              <span className="font-bold text-lg text-gray-800">路线规划</span>
            </div>
          )}
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || 
              (item.path !== '/' && location.pathname.startsWith(item.path));
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                  isActive 
                    ? 'bg-blue-50 text-blue-600' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && <span className="font-medium">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {sidebarOpen && (
          <div className="p-4 border-t border-gray-200 space-y-2">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <div className={`w-2 h-2 rounded-full ${health ? 'bg-green-500' : 'bg-red-500'}`} />
              <span>{health ? '服务正常' : '服务异常'}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-gray-50 p-2 rounded">
                <div className="text-gray-500">任务数</div>
                <div className="font-semibold text-gray-800">{stats.jobs}</div>
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <div className="text-gray-500">师傅数</div>
                <div className="font-semibold text-gray-800">{stats.workers}</div>
              </div>
            </div>
          </div>
        )}
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-gray-800">
              {navItems.find(item => 
                location.pathname === item.path || 
                (item.path !== '/' && location.pathname.startsWith(item.path))
              )?.label || '仪表盘'}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <Clock className="w-5 h-5 text-gray-400" />
            <span className="text-sm text-gray-600">
              {new Date().toLocaleString('zh-CN')}
            </span>
          </div>
        </header>

        <div className="flex-1 p-6 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
