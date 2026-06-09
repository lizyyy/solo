import { NavLink, useLocation } from 'react-router-dom';
import { FileText, BarChart3, Clock, LayoutGrid, Building2 } from 'lucide-react';

const NAV = [
  { to: '/', label: '材料送审表', icon: FileText },
  { to: '/monthly-board', label: '月底分类看板', icon: LayoutGrid },
  { to: '/history', label: '结论历史追溯', icon: Clock },
];

export function Sidebar() {
  const location = useLocation();

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-slate-900 to-slate-700 text-white shadow-inner-border">
            <Building2 size={18} />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900">日照体量图纸复核</div>
            <div className="text-[11px] text-slate-500">结构工程师工作台</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = location.pathname === item.to;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`sidebar-item ${active ? 'sidebar-item-active' : ''}`}
            >
              <Icon size={16} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-slate-100 p-4">
        <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-xs font-bold text-white">
            叶
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-slate-800">老叶</div>
            <div className="truncate text-[11px] text-slate-500">结构工程师</div>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
          <BarChart3 size={12} />
          <span>2026 年 6 月第 2 周 · 当日 共 3 次修改</span>
        </div>
      </div>
    </aside>
  );
}
