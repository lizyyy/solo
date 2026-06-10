import { useState, ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  ClipboardCheck,
  Layers,
  Download,
  PlayCircle,
  User as UserIcon,
  ChevronDown,
  Sticker,
  Menu,
  X,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { USERS } from '@/store/mockData';
import { ROLE_LABELS } from '@/types';

interface AppLayoutProps {
  children: ReactNode;
}

const NAV_ITEMS = [
  { to: '/', label: '预审工作台', Icon: ClipboardCheck, end: true },
  { to: '/drawings', label: '图纸版本中心', Icon: Layers },
  { to: '/export', label: '导出中心', Icon: Download },
  { to: '/run-review', label: '运行预审', Icon: PlayCircle },
];

export default function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, setCurrentUser, dirtyExport } = useAppStore();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const handleUserSelect = (u: { id: string }) => {
    setCurrentUser(u.id);
    setUserMenuOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col animate-blueprint-draw">
      <div className="fixed top-0 left-0 w-64 h-screen bg-steel-800/95 border-r-2 border-steel-600 z-30
                      hidden md:flex flex-col grid-paper">
        <div className="p-5 border-b-2 border-steel-600">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 border-2 border-dashed border-steel-400 flex items-center justify-center
                            bg-steel-900 transform rotate-[-3deg]">
              <Sticker className="w-5 h-5 text-blueprint-orange" />
            </div>
            <div>
              <h1 className="font-display text-lg text-steel-100 tracking-wider">PRE·AUDIT</h1>
              <p className="font-mono text-[10px] text-steel-400 uppercase tracking-widest">日照体量·碰撞审图</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setMobileNavOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 font-mono text-sm uppercase tracking-wider
                 border-2 transition-all duration-200 ${
                   isActive
                     ? 'bg-steel-700/80 border-steel-400 text-blueprint-orange shadow-stamp'
                     : 'border-transparent text-steel-300 hover:bg-steel-700/50 hover:border-steel-500 hover:text-steel-100'
                 }`
              }
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t-2 border-steel-600">
          <div className="font-mono text-[10px] text-steel-500 uppercase tracking-widest">
            v1.0 · 2026-JUN
          </div>
          <div className="font-mono text-xs text-steel-400 mt-1">© STRUCTURAL · DEPT</div>
        </div>
      </div>

      {mobileNavOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}
      <div
        className={`fixed top-0 left-0 w-72 h-screen bg-steel-800 border-r-2 border-steel-600 z-50
        flex flex-col grid-paper transition-transform duration-300 md:hidden
        ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="p-4 border-b-2 border-steel-600 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 border-2 border-dashed border-steel-400 flex items-center justify-center bg-steel-900">
              <Sticker className="w-5 h-5 text-blueprint-orange" />
            </div>
            <h1 className="font-display text-base text-steel-100">PRE·AUDIT</h1>
          </div>
          <button onClick={() => setMobileNavOpen(false)} className="text-steel-400 hover:text-steel-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setMobileNavOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 font-mono text-sm uppercase tracking-wider border-2 ${
                  isActive
                    ? 'bg-steel-700 border-steel-400 text-blueprint-orange'
                    : 'border-transparent text-steel-300 hover:bg-steel-700/50'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="md:pl-64 flex-1 flex flex-col">
        <header className="sticky top-0 z-20 h-16 bg-steel-800/95 backdrop-blur-sm border-b-2 border-steel-600
                          flex items-center px-4 md:px-6 gap-4">
          <button
            onClick={() => setMobileNavOpen(true)}
            className="md:hidden text-steel-300 hover:text-steel-100"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 px-3 py-1.5 border-2 border-dashed border-steel-500
                          bg-steel-900/60 transform rotate-[-1.5deg]">
            <div className="w-2 h-2 rounded-full bg-blueprint-green animate-pulse" />
            <span className="font-mono text-xs text-steel-300 tracking-wider uppercase">项目章</span>
            <span className="font-mono text-sm font-bold text-blueprint-orange tracking-wider">
              BIM-2026
            </span>
          </div>

          <div className="flex-1" />

          <button
            onClick={() => navigate('/export')}
            className="relative hidden sm:flex items-center gap-2 px-4 py-2 bg-steel-700 border-2 border-steel-500
                       hover:bg-steel-600 hover:border-blueprint-orange transition-all
                       font-mono text-xs uppercase tracking-wider text-steel-200
                       active:translate-y-[1px] active:shadow-stamp"
          >
            <Sticker className="w-4 h-4 text-blueprint-orange" />
            <span>导出印章</span>
            {dirtyExport && (
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[#C0392B] animate-ping" />
            )}
            {dirtyExport && (
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[#C0392B]" />
            )}
          </button>

          <div className="relative">
            <button
              onClick={() => setUserMenuOpen((v) => !v)}
              className="flex items-center gap-2 pr-2 pl-1 py-1 bg-steel-700 border-2 border-steel-500
                         hover:border-steel-400 transition-all"
            >
              <div className="w-8 h-8 border-2 border-dashed border-steel-400 bg-steel-900
                              flex items-center justify-center">
                {currentUser.avatar ? (
                  <span className="font-mono text-xs font-bold text-blueprint-orange">
                    {currentUser.avatar.slice(0, 2)}
                  </span>
                ) : (
                  <UserIcon className="w-4 h-4 text-steel-400" />
                )}
              </div>
              <div className="hidden sm:block text-left">
                <div className="font-mono text-xs text-steel-200">{currentUser.name}</div>
                <div className="font-mono text-[10px] text-steel-400 uppercase">
                  {ROLE_LABELS[currentUser.role]}
                </div>
              </div>
              <ChevronDown
                className={`w-3 h-3 text-steel-400 transition-transform ${
                  userMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setUserMenuOpen(false)} />
                <div className="absolute right-0 mt-2 w-52 bg-steel-800 border-2 border-steel-500 shadow-panel z-40">
                  <div className="px-3 py-2 border-b border-steel-700 bg-steel-900/50">
                    <div className="font-mono text-[10px] text-steel-400 uppercase tracking-wider">
                      切换身份
                    </div>
                  </div>
                  {USERS.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => handleUserSelect(u)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-left font-mono text-sm
                        border-b border-steel-700 last:border-b-0
                        ${
                          u.id === currentUser.id
                            ? 'bg-steel-700/70 text-blueprint-orange'
                            : 'text-steel-200 hover:bg-steel-700/40'
                        }`}
                    >
                      <div className="w-7 h-7 border border-steel-500 bg-steel-900 flex items-center justify-center">
                        <span className="font-mono text-[10px] font-bold text-blueprint-orange">
                          {u.avatar.slice(0, 2)}
                        </span>
                      </div>
                      <div>
                        <div className="text-xs">{u.name}</div>
                        <div className="text-[10px] uppercase text-steel-400">
                          {ROLE_LABELS[u.role]}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
