import { NavLink } from 'react-router-dom';
import { LayoutDashboard, ListChecks, RotateCcw, Flame, UserCircle2 } from 'lucide-react';
import { useMaterialStore } from '../store';
import { cn } from '../lib/utils';

const NAV = [
  { to: '/workbench', label: '主工作台', icon: LayoutDashboard },
  { to: '/review', label: '月底复核', icon: ListChecks },
];

export function TopNav() {
  const resetAll = useMaterialStore((s) => s.resetAll);
  return (
    <header className="bg-navy-grad text-white border-b-4 border-fire-500 shadow-lg relative z-20">
      <div className="px-6 py-3 flex items-center gap-6">
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-10 h-10 bg-fire-500 flex items-center justify-center border-2 border-white/20 rotate-3 shadow-lg">
            <Flame size={24} />
          </div>
          <div>
            <div className="font-song font-black text-lg tracking-wide leading-tight">
              消防分区材料追踪
            </div>
            <div className="text-[11px] text-navy-200 font-mono tracking-wider">
              FIRE MATERIAL · BIM COORDINATION · v1.0
            </div>
          </div>
        </div>

        <nav className="flex items-center gap-1 ml-2">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                cn(
                  'inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium transition-all',
                  'border-b-2',
                  isActive
                    ? 'border-fire-500 text-white bg-white/10'
                    : 'border-transparent text-navy-100 hover:text-white hover:bg-white/5',
                )
              }
            >
              <n.icon size={16} />
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <button
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-navy-200 hover:text-white hover:bg-white/10 border border-white/10 transition"
            onClick={() => {
              if (confirm('确定重置为初始示例数据？所有变更历史将丢失。')) {
                resetAll();
              }
            }}
            title="重置到初始示例数据"
          >
            <RotateCcw size={12} />
            重置数据
          </button>
          <div className="flex items-center gap-2 pl-3 border-l border-white/10">
            <div className="w-8 h-8 rounded-full bg-navy-300 flex items-center justify-center text-navy-800">
              <UserCircle2 size={20} />
            </div>
            <div className="text-xs leading-tight">
              <div className="font-bold">岑工</div>
              <div className="text-navy-200 text-[10px]">BIM 协调员</div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
