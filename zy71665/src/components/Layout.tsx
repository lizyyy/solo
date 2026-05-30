import { NavLink, Outlet } from 'react-router-dom';
import { Database, Calculator, Clock, Download } from 'lucide-react';
import { useFiberStore } from '@/store';

const navItems = [
  { to: '/', label: '数据录入', icon: Database },
  { to: '/calculation', label: '损耗计算', icon: Calculator },
  { to: '/history', label: '历史时间轴', icon: Clock },
  { to: '/export', label: '筛选导出', icon: Download },
];

export default function Layout() {
  const recordCount = useFiberStore((s) => s.records.length);
  const anomalyCount = useFiberStore((s) => s.anomalies.length);

  return (
    <div className="flex h-screen bg-[#F0F4F8]">
      <aside className="w-56 flex-shrink-0 bg-[#1B2A4A] text-white flex flex-col">
        <div className="px-5 py-6 border-b border-white/10">
          <h1 className="text-lg font-semibold tracking-tight" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            光纤损耗助手
          </h1>
          <p className="text-xs text-white/50 mt-1">Fiber Loss Analyzer</p>
        </div>

        <nav className="flex-1 py-4 space-y-1 px-3">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${
                  isActive
                    ? 'bg-[#E8A838] text-[#1B2A4A] font-semibold shadow-md shadow-[#E8A838]/30'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-5 py-4 border-t border-white/10 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/50">记录数</span>
            <span className="text-[#E8A838] font-semibold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {recordCount}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/50">异常数</span>
            <span className={`${anomalyCount > 0 ? 'text-red-400' : 'text-emerald-400'} font-semibold`} style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {anomalyCount}
            </span>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
