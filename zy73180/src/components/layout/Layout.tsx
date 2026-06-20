import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { AlertTriangle, Upload, Settings2, GitCompareArrows, FileSpreadsheet } from 'lucide-react';
import { useAppStore } from '@/store/appStore';

const navItems = [
  { to: '/', label: '异常队列', icon: AlertTriangle, desc: '需要关注的问题' },
  { to: '/import', label: '历史答案', icon: Upload, desc: '导入与映射' },
  { to: '/config', label: '验算配置', icon: Settings2, desc: '公式与参数' },
  { to: '/compare', label: '对比报告', icon: GitCompareArrows, desc: '复算结果对比' },
];

export default function Layout() {
  const currentRun = useAppStore(s => s.currentRun);
  const location = useLocation();

  const anomalyCount = currentRun?.anomalyCount ?? 0;

  return (
    <div className="min-h-screen flex bg-ink-50">
      <aside className="w-64 bg-white border-r border-ink-200 flex flex-col flex-shrink-0 sticky top-0 h-screen">
        <div className="px-5 py-5 border-b border-ink-200">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-ink-900 flex items-center justify-center shadow-soft">
              <FileSpreadsheet className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h1 className="font-serif text-base font-bold text-ink-900 leading-tight">
                约束规划验算
              </h1>
              <p className="text-[11px] text-ink-400 leading-tight mt-0.5">批量验算 · 异常队列</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
          {navItems.map(item => {
            const isActive = location.pathname === item.to;
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-150 group ${
                  isActive
                    ? 'bg-ink-900 text-white shadow-soft'
                    : 'text-ink-600 hover:bg-ink-100'
                }`}
              >
                <Icon className={`w-[18px] h-[18px] flex-shrink-0 ${isActive ? 'text-amber-400' : 'text-ink-400 group-hover:text-ink-600'}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium leading-tight">{item.label}</div>
                  <div className={`text-[11px] leading-tight mt-0.5 ${isActive ? 'text-ink-200' : 'text-ink-400'}`}>
                    {item.desc}
                  </div>
                </div>
                {item.to === '/' && anomalyCount > 0 && (
                  <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${
                    isActive ? 'bg-amber-500 text-ink-900' : 'bg-anomaly-unit text-white'
                  }`}>
                    {anomalyCount}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {currentRun && (
          <div className="px-4 py-3 border-t border-ink-200">
            <div className="text-[11px] text-ink-400 mb-1">当前验算</div>
            <div className="text-xs font-medium text-ink-700 truncate">{currentRun.name}</div>
            <div className="text-[11px] text-ink-400 mt-1">
              {currentRun.totalCount} 条 · {currentRun.anomalyCount} 异常
            </div>
          </div>
        )}
      </aside>

      <main className="flex-1 min-w-0 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
