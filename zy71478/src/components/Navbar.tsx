import { NavLink } from 'react-router-dom';
import { Thermometer, Calculator, BarChart3, History, Home } from 'lucide-react';

export default function Navbar() {
  const navItems = [
    { to: '/', icon: Home, label: '数据录入' },
    { to: '/calculator', icon: Calculator, label: '校准计算' },
    { to: '/charts', icon: BarChart3, label: '筛选图表' },
    { to: '/history', icon: History, label: '历史记录' },
  ];

  return (
    <nav className="bg-slate-900 border-b border-slate-700 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Thermometer className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">声速温度校准表</h1>
              <p className="text-xs text-slate-400">Sound Velocity Calibration</p>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`
                }
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
