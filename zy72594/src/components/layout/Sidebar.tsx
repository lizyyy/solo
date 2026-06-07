import { NavLink, useLocation } from 'react-router-dom';
import { FileBarChart, Upload, BarChart3, AlertTriangle, Home } from 'lucide-react';

const navItems = [
  { path: '/', label: '报告列表', icon: Home },
  { path: '/import', label: '导入实验桶', icon: Upload },
];

export function Sidebar() {
  const location = useLocation();
  const reportId = location.pathname.match(/\/report\/([^/]+)/)?.[1];

  const reportNavItems = reportId
    ? [
        { path: `/report/${reportId}`, label: '报告详情', icon: FileBarChart },
        { path: `/report/${reportId}/visualization`, label: '可视化分析', icon: BarChart3 },
        { path: `/report/${reportId}/anomalies`, label: '异常样本', icon: AlertTriangle },
      ]
    : [];

  return (
    <aside className="w-64 bg-slate-900 min-h-screen flex flex-col">
      <div className="p-6 border-b border-slate-800">
        <h1 className="text-xl font-bold text-white font-serif">置信度校准</h1>
        <p className="text-xs text-slate-400 mt-1">Confidence Calibration</p>
      </div>
      
      <nav className="flex-1 p-4 space-y-1">
        <div className="text-xs text-slate-500 uppercase tracking-wider mb-3 px-3">主菜单</div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${
                isActive
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Icon size={18} />
              {item.label}
            </NavLink>
          );
        })}

        {reportNavItems.length > 0 && (
          <>
            <div className="text-xs text-slate-500 uppercase tracking-wider mt-6 mb-3 px-3">当前报告</div>
            {reportNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${
                    isActive
                      ? 'bg-sky-600/20 text-sky-400 border border-sky-600/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <Icon size={18} />
                  {item.label}
                </NavLink>
              );
            })}
          </>
        )}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-400 to-emerald-400 flex items-center justify-center text-white text-xs font-bold">
            唐
          </div>
          <div>
            <p className="text-sm text-white">推荐策略老唐</p>
            <p className="text-xs text-slate-500">策略负责人</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
