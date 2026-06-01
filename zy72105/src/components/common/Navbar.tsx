import { Link, useLocation } from 'react-router-dom';
import { Activity, History, Settings, FileText, AlertTriangle } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

export const Navbar = () => {
  const location = useLocation();
  const { batches } = useAppStore();

  const unresolvedCount = batches.reduce((sum, batch) => {
    return sum + batch.conflicts.filter((c) => !c.resolution).length;
  }, 0);

  const navItems = [
    { path: '/', label: '主工作台', icon: Activity },
    { path: '/history', label: '历史对比', icon: History },
    { path: '/report', label: '报告预览', icon: FileText },
    { path: '/settings', label: '阈值配置', icon: Settings },
  ];

  return (
    <nav className="bg-slate-900 border-b border-slate-700">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-lg">无人机旋翼噪声预测</h1>
              <p className="text-slate-400 text-xs">维修分析系统</p>
            </div>
          </div>

          <div className="flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path === '/report' ? '/report/demo' : item.path}
                  className={`px-4 py-2 rounded-lg flex items-center space-x-2 transition-all duration-200 ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{item.label}</span>
                  {item.path === '/' && unresolvedCount > 0 && (
                    <span className="flex items-center justify-center w-5 h-5 bg-red-500 text-white text-xs rounded-full animate-pulse">
                      {unresolvedCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
};
