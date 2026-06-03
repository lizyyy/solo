import React, { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FileText, 
  Table2, 
  FileBarChart, 
  PlayCircle,
  User,
  ChevronLeft,
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import { useWindStore } from '../store/useWindStore';

const navItems = [
  { path: '/', label: '小看板', icon: LayoutDashboard },
  { path: '/logs', label: '点云抽稀日志', icon: FileText },
  { path: '/radius', label: '安全半径表', icon: Table2 },
  { path: '/report', label: '安全距离报告', icon: FileBarChart },
  { path: '/demo', label: '流程演示', icon: PlayCircle },
];

export const Layout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { currentRole, setCurrentRole, resetToDemo } = useWindStore();

  return (
    <div className="flex h-screen bg-industrial-50">
      {/* 侧边栏 */}
      <aside 
        className={`bg-industrial-800 text-white transition-all duration-300 flex flex-col ${
          collapsed ? 'w-16' : 'w-64'
        }`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-industrial-700">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-safety-orange rounded flex items-center justify-center font-mono font-bold text-sm">
                风
              </div>
              <span className="font-mono font-semibold text-sm">滑翔伞起降区风向图</span>
            </div>
          )}
          {collapsed && (
            <div className="w-8 h-8 bg-safety-orange rounded flex items-center justify-center font-mono font-bold text-sm mx-auto">
              风
            </div>
          )}
          <button 
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 hover:bg-industrial-700 rounded transition-colors"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* 导航 */}
        <nav className="flex-1 py-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 transition-all duration-200 ${
                    isActive 
                      ? 'bg-industrial-700 border-l-2 border-safety-orange text-white' 
                      : 'text-industrial-300 hover:bg-industrial-700 hover:text-white'
                  }`
                }
              >
                <Icon size={18} />
                {!collapsed && <span className="text-sm">{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* 底部 - 角色切换和重置 */}
        <div className="border-t border-industrial-700 p-4">
          {!collapsed ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-industrial-300">
                  <User size={14} />
                  <span>当前角色:</span>
                </div>
                <select
                  value={currentRole}
                  onChange={(e) => setCurrentRole(e.target.value as 'engineer' | 'manager')}
                  className="bg-industrial-700 text-white text-xs px-2 py-1 rounded border border-industrial-600 focus:outline-none focus:border-safety-orange"
                >
                  <option value="engineer">许工</option>
                  <option value="manager">施工经理</option>
                </select>
              </div>
              <button
                onClick={resetToDemo}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-industrial-700 hover:bg-industrial-600 text-industrial-200 rounded text-sm transition-colors"
              >
                <RefreshCw size={14} />
                重置演示数据
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={resetToDemo}
                className="p-2 hover:bg-industrial-700 rounded transition-colors"
                title="重置演示数据"
              >
                <RefreshCw size={16} />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* 主内容区 */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* 顶部栏 */}
        <header className="h-14 bg-white border-b border-industrial-200 flex items-center justify-between px-6">
          <div>
            <h1 className="text-lg font-semibold text-industrial-800 font-mono">
              滑翔伞起降区安全距离评估系统
            </h1>
          </div>
          <div className="flex items-center gap-4 text-sm text-industrial-600">
            <span className="font-mono">
              {new Date().toLocaleDateString('zh-CN')}
            </span>
          </div>
        </header>

        {/* 内容区 */}
        <div className="flex-1 overflow-auto p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
