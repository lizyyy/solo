import { NavLink, Outlet } from 'react-router-dom';
import { Volume2, Link2, ClipboardCheck, Trash2 } from 'lucide-react';
import { useStore } from '@/store/useStore';

const navItems = [
  { to: '/', label: '噪声归集', icon: Volume2 },
  { to: '/association', label: '课程关联', icon: Link2 },
  { to: '/status', label: '处理状态', icon: ClipboardCheck },
];

export default function Layout() {
  const noiseCount = useStore((s) => s.noiseRecords.filter((r) => !r.isDuplicate).length);
  const conflictCount = useStore((s) => s.conflicts.filter((c) => !c.isResolved).length);
  const pendingCount = useStore((s) => s.processingStatuses.filter((p) => p.status === 'PENDING').length);
  const clearAllData = useStore((s) => s.clearAllData);

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-56 flex-shrink-0 bg-base-800 border-r border-base-600/50 flex flex-col">
        <div className="p-5 border-b border-base-600/30">
          <h1 className="font-mono font-bold text-amber text-lg leading-tight tracking-tight">
            噪声投诉台账
          </h1>
          <p className="text-xs text-gray-500 mt-1 font-mono">NOISE COMPLAINT LEDGER</p>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${
                  isActive
                    ? 'bg-amber-muted text-amber font-medium vu-glow'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-base-700'
                }`
              }
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-base-600/30 space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="card-base p-2">
              <div className="text-amber font-mono font-bold text-sm">{noiseCount}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">投诉</div>
            </div>
            <div className="card-base p-2">
              <div className="text-danger font-mono font-bold text-sm">{conflictCount}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">冲突</div>
            </div>
            <div className="card-base p-2">
              <div className="text-warning font-mono font-bold text-sm">{pendingCount}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">待处理</div>
            </div>
          </div>
          <button
            onClick={clearAllData}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-500 hover:text-danger hover:bg-danger-muted transition-colors"
          >
            <Trash2 size={14} />
            清空数据
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto bg-base-900">
        <Outlet />
      </main>
    </div>
  );
}
