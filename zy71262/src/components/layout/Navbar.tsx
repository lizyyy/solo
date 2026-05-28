import { NavLink } from 'react-router-dom';
import { Box, Database, Layers, FileBarChart } from 'lucide-react';

export function Navbar() {
  const navItems = [
    { path: '/', icon: Box, label: '配方立方' },
    { path: '/data', icon: Database, label: '数据管理' },
    { path: '/schemes', icon: Layers, label: '方案管理' },
    { path: '/reports', icon: FileBarChart, label: '报告中心' },
  ];

  return (
    <nav className="bg-slate-800 border-b border-slate-700 px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <Box className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">画材色料配方立方</h1>
            <p className="text-xs text-slate-400">Pigment Formula Cube</p>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                    : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}
