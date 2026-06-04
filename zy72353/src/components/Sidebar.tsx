import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileBarChart,
  Box,
  Workflow,
  FileText,
  Thermometer,
} from 'lucide-react';
import { useThresholdStore } from '../store/thresholdStore';

const Sidebar = () => {
  const location = useLocation();
  const { currentRole, setCurrentRole } = useThresholdStore();

  const navItems = [
    { path: '/', label: '数据概览', icon: LayoutDashboard },
    { path: '/visualization', label: '可视化展示', icon: Box },
    { path: '/workflow', label: '工作流中心', icon: Workflow },
    { path: '/report', label: '交接报告', icon: FileText },
  ];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="w-64 bg-industrial-600 min-h-screen flex flex-col border-r border-industrial-500">
      <div className="p-6 border-b border-industrial-500">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-500 rounded-lg flex items-center justify-center">
            <Thermometer className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-white font-mono font-bold text-lg">阈值管理</h1>
            <p className="text-industrial-300 text-xs">冷凝管结霜系统</p>
          </div>
        </div>
      </div>

      <div className="flex-1 py-4">
        <nav className="px-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                  active
                    ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30'
                    : 'text-industrial-200 hover:bg-industrial-500 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-industrial-500">
        <div className="bg-industrial-700 rounded-lg p-4">
          <p className="text-industrial-300 text-xs mb-2">当前角色</p>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentRole('engineer')}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                currentRole === 'engineer'
                  ? 'bg-primary-500 text-white'
                  : 'bg-industrial-600 text-industrial-300 hover:bg-industrial-500'
              }`}
            >
              何工
            </button>
            <button
              onClick={() => setCurrentRole('coach')}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                currentRole === 'coach'
                  ? 'bg-success-500 text-white'
                  : 'bg-industrial-600 text-industrial-300 hover:bg-industrial-500'
              }`}
            >
              训练教练
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
