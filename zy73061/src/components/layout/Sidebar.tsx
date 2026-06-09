import { NavLink } from 'react-router-dom';
import { LayoutDashboard, ClipboardList, History, Calculator, Gauge, Bell } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

const navItems = [
  { to: '/', label: '汇总仪表盘', icon: LayoutDashboard, end: true },
  { to: '/inspections', label: '巡检明细', icon: ClipboardList },
  { to: '/timeline', label: '历史时间线', icon: History },
  { to: '/formula', label: '预警公式说明', icon: Calculator },
];

export default function Sidebar() {
  const duplicates = useAppStore((s) => s.duplicates);
  const pendingCount = duplicates.length;

  return (
    <aside className="hidden lg:flex w-60 shrink-0 flex-col bg-industrial-700 text-white/90">
      <div className="px-5 py-5 border-b border-white/10 flex items-center gap-2">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-industrial-300 to-industrial-500 flex items-center justify-center">
          <Gauge className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="title-font text-base font-semibold text-white leading-tight">管线阈值预警</div>
          <div className="text-[11px] text-industrial-200 mt-0.5">透明化监控台</div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `group flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors relative ${
                isActive
                  ? 'bg-industrial-500 text-white shadow-inner'
                  : 'text-industrial-100 hover:bg-industrial-600 hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-alert-blue rounded-r" />
                )}
                <item.icon className="w-4 h-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.to === '/inspections' && pendingCount > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-alert-yellow text-industrial-900 text-[10px] font-bold">
                    {pendingCount}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-white/10">
        <div className="text-[11px] text-industrial-300 mb-2">材料入口 · 异常出口</div>
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-industrial-600/60 border border-white/5">
          <Bell className="w-4 h-4 text-alert-yellow shrink-0 mt-0.5" />
          <div className="text-[12px] leading-relaxed">
            <span className="text-white">新手路径：</span>
            <span className="text-industrial-100">
              先看仪表盘 → 点黄色数字 → 追异常抽屉 → 翻公式说明
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
