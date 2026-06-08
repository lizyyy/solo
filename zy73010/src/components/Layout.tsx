import { ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ClipboardCheck, Home, AlertTriangle, FileDown, LogOut, PawPrint, User } from 'lucide-react';

interface Props { children: ReactNode; }

const navItems = [
  { to: '/', label: '复核工作台', Icon: Home, end: true },
  { to: '/exceptions', label: '异常队列', Icon: AlertTriangle },
  { to: '/export', label: '导出中心', Icon: FileDown },
];

export function Layout({ children }: Props) {
  const loc = useLocation();
  const navigate = useNavigate();
  const recordPath = loc.pathname.startsWith('/record/');

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 shrink-0 bg-white/80 backdrop-blur-xl border-r border-ink-100/80 p-5 flex flex-col fixed h-screen">
        <div className="flex items-center gap-3 mb-8 px-1">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white flex items-center justify-center shadow-md shadow-brand-600/30">
            <PawPrint size={22} />
          </div>
          <div>
            <div className="font-serif font-bold text-lg text-ink-700 leading-tight">寄养复核中心</div>
            <div className="text-[11px] text-ink-300">Pet Boarding Review</div>
          </div>
        </div>

        <nav className="flex-1 space-y-1.5">
          {navItems.map(({ to, label, Icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => `nav-item ${(isActive || (to === '/' && recordPath)) ? '' : ''} ${isActive ? 'nav-item-active' : ''}`}>
              <Icon size={18} />
              <span>{label}</span>
              {(to === '/' && recordPath) && (
                <span className="ml-auto text-[10px] text-brand-300">详情页</span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-4 pt-5 border-t border-ink-100 space-y-3">
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-ink-50/60">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent-300 to-accent-500 text-white flex items-center justify-center">
              <User size={16} />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-ink-700 truncate">老周</div>
              <div className="text-[11px] text-ink-300">寄养店长</div>
            </div>
          </div>
          <button className="nav-item text-ink-400 hover:text-warn-500 hover:bg-warn-500/5">
            <LogOut size={18} />
            <span>退出登录</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 ml-64 min-h-screen">
        <header className="sticky top-0 z-30 bg-white/70 backdrop-blur-xl border-b border-ink-100/60">
          <div className="max-w-7xl mx-auto px-8 py-4 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="page-title">
                {recordPath ? '寄养记录复核详情' :
                  loc.pathname === '/exceptions' ? '异常队列管理' :
                  loc.pathname === '/export' ? '导出中心' : '复核工作台'}
              </h1>
              <p className="text-xs text-ink-500 mt-0.5">
                {recordPath ? '查看体重曲线 / 异常照片 / 疫苗信息，编辑复核备注并同步结果' :
                  loc.pathname === '/exceptions' ? '聚合所有异常记录，校验状态与备注、文件结论一致性' :
                  loc.pathname === '/export' ? '一键导出复核报告和异常队列，查看版本变更差异对比' :
                  '待复核记录列表与统计概览，多条件筛选快速定位'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {recordPath && (
                <button onClick={() => navigate('/')} className="btn-ghost">
                  ← 返回列表
                </button>
              )}
              <div className="flex items-center gap-1.5 chip bg-brand-50 text-brand-700 px-3 py-1.5">
                <ClipboardCheck size={13} />
                <span className="text-xs font-medium">复核模式</span>
              </div>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
