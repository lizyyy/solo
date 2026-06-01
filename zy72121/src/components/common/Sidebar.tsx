import { NavLink } from 'react-router-dom';
import { Calculator, History, FileText, Settings, Thermometer } from 'lucide-react';
import { cn } from '../../utils/cn';

const navItems = [
  { path: '/', label: '计算面板', icon: Calculator },
  { path: '/history', label: '历史对比', icon: History },
  { path: '/report', label: '报告导出', icon: FileText },
  { path: '/settings', label: '参数设置', icon: Settings },
];

export default function Sidebar() {
  return (
    <div className="w-60 bg-slate-900 text-white flex flex-col h-screen fixed left-0 top-0">
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <Thermometer className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-sm">冷库门帘</h1>
            <p className="text-xs text-slate-400">热损失核算工具</p>
          </div>
        </div>
      </div>
      
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all',
                isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              )
            }
          >
            <item.icon className="w-5 h-5" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-700">
        <div className="text-xs text-slate-400">
          <p>当前用户：何工</p>
          <p className="mt-1">数据来源：设备巡检表</p>
        </div>
      </div>
    </div>
  );
}
