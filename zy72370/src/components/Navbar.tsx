import { Link, useLocation } from 'react-router-dom';
import { Droplets, AlertTriangle, ClipboardCheck, Calculator, RotateCcw } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { roleLabels } from '../data/mockData';
import type { UserRole } from '../types';

const navItems = [
  { path: '/', label: '演示主页', icon: Droplets },
  { path: '/threshold-conflict', label: '阈值冲突', icon: AlertTriangle },
  { path: '/review', label: '记录复核', icon: ClipboardCheck },
  { path: '/conversion', label: '单位换算', icon: Calculator },
];

const roles: { value: UserRole; label: string }[] = [
  { value: 'analyst', label: roleLabels.analyst },
  { value: 'engineer', label: roleLabels.engineer },
  { value: 'technician', label: roleLabels.technician },
];

export default function Navbar() {
  const location = useLocation();
  const currentRole = useAppStore((s) => s.currentRole);
  const setCurrentRole = useAppStore((s) => s.setCurrentRole);
  const resetDemo = useAppStore((s) => s.resetDemo);

  return (
    <nav className="bg-[#1e3a5f] border-b-2 border-[#2d5a87] shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-2">
            <Droplets className="w-8 h-8 text-[#5dade2] animate-pulse" />
            <span className="text-xl font-bold text-white tracking-wide">
              雨滴终端速度演示
            </span>
          </div>

          <div className="flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`
                    flex items-center space-x-2 px-4 py-2 rounded-sm
                    transition-all duration-200 text-sm font-medium
                    ${isActive
                      ? 'bg-[#2d5a87] text-white border border-[#5dade2]'
                      : 'text-gray-300 hover:bg-[#2d5a87] hover:text-white'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <span className="text-gray-400 text-sm">角色：</span>
              <select
                value={currentRole}
                onChange={(e) => setCurrentRole(e.target.value as UserRole)}
                className="
                  bg-[#0f2744] text-white text-sm px-3 py-1.5
                  border border-[#2d5a87] rounded-sm
                  focus:outline-none focus:border-[#5dade2]
                  cursor-pointer
                "
              >
                {roles.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={resetDemo}
              className="
                flex items-center space-x-1 px-3 py-1.5
                bg-[#c0392b] text-white text-sm rounded-sm
                hover:bg-[#e74c3c] transition-colors
                border border-[#e74c3c]
              "
              title="重置演示数据"
            >
              <RotateCcw className="w-4 h-4" />
              <span>重置</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
