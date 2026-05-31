import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Home,
  BarChart3,
  Download,
  Settings,
  Menu,
  X,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

const navItems = [
  { path: '/', icon: Home, label: '校对工作台' },
  { path: '/changes', icon: BarChart3, label: '变更分析' },
  { path: '/export', icon: Download, label: '导出中心' },
  { path: '/settings', icon: Settings, label: '设置中心' },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();
  const { currentTask } = useAppStore();

  const pendingIssues = currentTask?.issues.filter((i) => !i.resolved).length || 0;
  const conclusionChanges = currentTask?.changes.filter((c) => c.type === 'conclusion').length || 0;

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <motion.aside
        initial={false}
        animate={{ width: sidebarOpen ? 240 : 64 }}
        className="bg-primary-500 text-white flex flex-col shadow-xl"
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-primary-600">
          {sidebarOpen && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="font-bold text-lg"
            >
              展板校对
            </motion.span>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-primary-600 rounded-lg transition-colors"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="flex-1 py-4">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 mx-2 rounded-lg transition-all mb-1 ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'text-primary-100 hover:bg-primary-600/50'
                }`}
              >
                <Icon size={20} />
                {sidebarOpen && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-sm font-medium"
                  >
                    {item.label}
                  </motion.span>
                )}
              </Link>
            );
          })}
        </nav>

        {sidebarOpen && currentTask && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 border-t border-primary-600"
          >
            <p className="text-xs text-primary-200 mb-2">当前任务</p>
            <p className="text-sm font-medium truncate mb-3">{currentTask.name}</p>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1">
                  <AlertTriangle size={12} className="text-conclusion" />
                  结论变更
                </span>
                <span className="font-bold text-conclusion">{conclusionChanges}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1">
                  <CheckCircle2 size={12} className="text-material" />
                  待处理问题
                </span>
                <span className="font-bold">{pendingIssues}</span>
              </div>
            </div>
          </motion.div>
        )}
      </motion.aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6">
          <h1 className="text-lg font-semibold text-slate-800">
            {navItems.find((item) => item.path === location.pathname)?.label || '展板文案校对'}
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500">
              {new Date().toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </div>
        </header>

        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
