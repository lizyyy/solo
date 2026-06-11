import { NavLink } from 'react-router-dom';
import {
  Building2,
  SearchCheck,
  History,
  Download,
  User as UserIcon,
  CalendarDays,
} from 'lucide-react';
import { useAppStore } from '@/store';
import { useEffect } from 'react';

export default function NavBar() {
  const user = useAppStore((s) => s.user);
  const fetchUser = useAppStore((s) => s.fetchUser);
  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const navCls = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors border-b-2 ${
      isActive
        ? 'text-white border-caution-orange'
        : 'text-white/75 border-transparent hover:text-white hover:border-white/40'
    }`;

  return (
    <header className="bg-engineering-navy text-white shadow-md">
      <div className="max-w-[1600px] mx-auto flex items-center gap-6 px-5 h-14">
        <div className="flex items-center gap-2 pr-4 border-r border-white/15">
          <div className="w-8 h-8 bg-caution-orange rounded-sm flex items-center justify-center title-font font-bold text-sm">
            施
          </div>
          <div>
            <div className="title-font font-semibold text-[15px] tracking-wide leading-tight">
              施工变更碰撞预审
            </div>
            <div className="text-[10px] text-white/60 leading-tight">
              Construction Collision Pre-Audit · v1.0
            </div>
          </div>
        </div>

        <nav className="flex items-center gap-1 h-full">
          <NavLink to="/collisions" end className={navCls}>
            <Building2 size={15} />
            碰撞点
          </NavLink>
          <NavLink to="/audit" className={navCls}>
            <History size={15} />
            审计历史
          </NavLink>
          <NavLink to="/export" className={navCls}>
            <Download size={15} />
            导出中心
          </NavLink>
        </nav>

        <div className="flex-1" />

        <div className="flex items-center gap-4 text-xs text-white/70">
          <span className="flex items-center gap-1">
            <CalendarDays size={13} />
            2026年6月 · 月底封账
          </span>
          <div className="flex items-center gap-2 pl-3 border-l border-white/15">
            <div className="w-7 h-7 rounded-sm bg-engineering-navy-light border border-white/20 flex items-center justify-center">
              <UserIcon size={14} />
            </div>
            <div className="leading-tight">
              <div className="text-white font-medium">
                {user ? user.name : '加载中…'}
              </div>
              <div className="text-[10px] text-white/50">
                工号 {user?.id ?? '—'} ·{' '}
                {user?.role === 'engineer' ? '算法值班人' : user?.role === 'designer' ? '设计院助理' : '审核'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
