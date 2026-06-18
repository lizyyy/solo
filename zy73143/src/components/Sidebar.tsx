import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Waves,
  MapPin,
  AlertTriangle,
  History,
  Leaf,
} from 'lucide-react';

const navItems = [
  { path: '/', label: '总览仪表盘', icon: LayoutDashboard },
  { path: '/buoy-logs', label: '浮标日志', icon: Waves },
  { path: '/spatial-marking', label: '空间标注', icon: MapPin },
  { path: '/anomalies', label: '异常中心', icon: AlertTriangle },
  { path: '/audit', label: '变更审计', icon: History },
];

const Sidebar = () => {
  return (
    <aside className="w-60 bg-gradient-to-b from-ocean-900 to-ocean-950 text-white flex flex-col h-screen sticky top-0">
      <div className="p-5 border-b border-ocean-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-seagrass-400 to-ocean-500 flex items-center justify-center shadow-lg">
            <Leaf className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-base leading-tight">海草床调查</h1>
            <p className="text-ocean-300 text-xs">空间标注系统</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 py-4 px-3">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 group ${
                      isActive
                        ? 'bg-ocean-800/60 text-white shadow-inner'
                        : 'text-ocean-200 hover:bg-ocean-800/40 hover:text-white'
                    }`
                  }
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm font-medium">{item.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-ocean-800">
        <div className="bg-ocean-800/40 rounded-lg p-3">
          <p className="text-ocean-200 text-xs mb-2">调查工程师</p>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-coral-400 to-coral-600 flex items-center justify-center text-white text-sm font-bold">
              何
            </div>
            <div>
              <p className="text-sm font-medium text-white">老何</p>
              <p className="text-xs text-ocean-300">港口工程师</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
