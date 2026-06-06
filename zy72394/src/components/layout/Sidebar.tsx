import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Thermometer,
  Cpu,
  LineChart,
  History,
  ClipboardCheck,
  FileBarChart,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';

const menuItems = [
  { path: '/dashboard', label: '首页仪表盘', icon: LayoutDashboard },
  { path: '/thresholds', label: '安全阈值表', icon: Thermometer },
  { path: '/equipment', label: '设备铭牌参数', icon: Cpu },
  { path: '/tracking', label: '温度追踪看板', icon: LineChart },
  { path: '/playback', label: '参数回放', icon: History },
  { path: '/review', label: '复核工作台', icon: ClipboardCheck },
  { path: '/reports', label: '报告中心', icon: FileBarChart },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <aside
      className={`bg-primary-500 text-white h-screen flex flex-col transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      <div className="p-4 flex items-center justify-between border-b border-white/10">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <Thermometer className="w-6 h-6" />
            <span className="font-bold text-lg">养护温度追踪</span>
          </div>
        )}
        {collapsed && <Thermometer className="w-6 h-6 mx-auto" />}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 hover:bg-white/10 rounded transition-colors"
        >
          {collapsed ? <Menu className="w-5 h-5" /> : <X className="w-5 h-5" />}
        </button>
      </div>

      <nav className="flex-1 py-4 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 transition-all duration-200 ${
                isActive
                  ? 'bg-white/20 border-l-4 border-white'
                  : 'hover:bg-white/10 border-l-4 border-transparent'
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span className="text-sm">{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/10">
        {!collapsed && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm">
              唐
            </div>
            <div>
              <p className="text-sm font-medium">训练教练老唐</p>
              <p className="text-xs text-white/60">在线</p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 mx-auto rounded-full bg-white/20 flex items-center justify-center text-sm">
            唐
          </div>
        )}
      </div>
    </aside>
  );
}
