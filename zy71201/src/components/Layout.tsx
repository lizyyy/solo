import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileBarChart,
  History,
  Upload,
  FileOutput,
  Menu,
  X,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useStore } from '../store/useStore';

interface LayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { path: '/', label: '预警列表', icon: LayoutDashboard },
  { path: '/import', label: '数据导入', icon: Upload },
  { path: '/export', label: '周报导出', icon: FileOutput },
];

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();
  const { products } = useStore();

  const warningCount = products.filter(
    (p) => p.status === 'warning' || p.status === 'stop_loss'
  ).length;
  const anomalyCount = products.filter((p) => p.anomalies.length > 0).length;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside
        className={cn(
          'bg-navy-900 text-white transition-all duration-300 flex flex-col',
          sidebarOpen ? 'w-64' : 'w-16'
        )}
      >
        <div className="p-4 border-b border-navy-700 flex items-center justify-between">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-warning" />
              <span className="font-bold text-lg">净值预警</span>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-navy-700 rounded transition-colors"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-lg transition-all',
                  isActive
                    ? 'bg-navy-700 text-white shadow-inner'
                    : 'text-gray-300 hover:bg-navy-800 hover:text-white'
                )}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && <span>{item.label}</span>}
                {sidebarOpen && item.path === '/' && warningCount > 0 && (
                  <span className="ml-auto bg-danger text-white text-xs px-2 py-0.5 rounded-full">
                    {warningCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {sidebarOpen && (
          <div className="p-4 border-t border-navy-700 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">待处理预警</span>
              <span className="text-warning font-semibold">{warningCount}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">异常记录</span>
              <span className="text-danger font-semibold">{anomalyCount}</span>
            </div>
          </div>
        )}
      </aside>

      <main className="flex-1 flex flex-col min-h-screen">
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
          <div>
            <h1 className="text-xl font-semibold text-gray-800">
              {navItems.find((n) => n.path === location.pathname)?.label || '详情'}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {new Date().toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long',
              })}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-800">客服-小王</p>
              <p className="text-xs text-gray-500">客服专员</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-navy-100 flex items-center justify-center text-navy-700 font-semibold">
              王
            </div>
          </div>
        </header>

        <div className="flex-1 p-6 overflow-auto">{children}</div>
      </main>
    </div>
  );
}
