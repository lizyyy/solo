import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, ClipboardList, AlertTriangle, FileBarChart, Drama, Download, Trash2 } from 'lucide-react';
import { usePropStore } from '@/store';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: '出入库看板' },
  { to: '/entry', icon: ClipboardList, label: '道具录入' },
  { to: '/anomalies', icon: AlertTriangle, label: '异常检测中心' },
  { to: '/report', icon: FileBarChart, label: '库存报告' },
];

export default function Layout() {
  const loadSampleData = usePropStore((s) => s.loadSampleData);
  const clearAllData = usePropStore((s) => s.clearAllData);

  const handleClear = () => {
    if (window.confirm('确认清空所有数据？此操作不可撤销。')) {
      clearAllData();
    }
  };

  return (
    <div className="flex h-screen" style={{ background: '#0f0f1a' }}>
      <aside
        className={cn(
          'flex flex-col w-[240px] shrink-0',
          'bg-gradient-to-b from-[#1a1a2e] to-[#16162a]',
          'border-r border-[#d4a843]/30'
        )}
      >
        <div className="flex items-center gap-3 px-5 py-6 border-b border-[#d4a843]/20">
          <Drama className="w-7 h-7 text-[#d4a843]" />
          <h1 className="text-lg font-bold text-[#d4a843] tracking-wide">剧场道具出入库</h1>
        </div>

        <nav className="flex-1 py-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-5 py-3 text-sm transition-colors',
                  isActive
                    ? 'bg-[#d4a843]/10 text-[#d4a843] border-l-[3px] border-[#d4a843]'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/5 border-l-[3px] border-transparent'
                )
              }
            >
              <Icon className="w-5 h-5" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-4 space-y-2 border-t border-[#d4a843]/20">
          <button
            onClick={loadSampleData}
            className={cn(
              'w-full flex items-center justify-center gap-2 px-3 py-2 rounded text-sm',
              'bg-[#d4a843]/15 text-[#d4a843] hover:bg-[#d4a843]/25 transition-colors'
            )}
          >
            <Download className="w-4 h-4" />
            导入样例
          </button>
          <button
            onClick={handleClear}
            className={cn(
              'w-full flex items-center justify-center gap-2 px-3 py-2 rounded text-sm',
              'bg-red-900/20 text-red-400 hover:bg-red-900/40 transition-colors'
            )}
          >
            <Trash2 className="w-4 h-4" />
            清空数据
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
