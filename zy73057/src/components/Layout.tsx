import { NavLink, Outlet } from 'react-router-dom';
import { List, SearchCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

const navLinks = [
  { label: '排程列表', to: '/', icon: List },
  { label: '按签名追回', to: '/retrieve', icon: SearchCheck },
];

export default function Layout() {
  return (
    <div className="min-h-full flex flex-col">
      <header className="fixed top-0 left-0 right-0 z-50 bg-ink-900 border-b-2 border-warn-400 h-16">
        <div className="max-w-[1440px] mx-auto h-full px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="font-display text-warn-400 text-xl tracking-wider">ELEV·SPM</span>
            <span className="text-ink-100 text-base font-medium">电梯故障备件排程</span>
          </div>
          <nav className="flex items-center gap-1">
            {navLinks.map(({ label, to, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 px-4 py-2 rounded-sm text-sm font-medium transition-colors',
                    isActive
                      ? 'text-warn-400 bg-warn-400/10'
                      : 'text-ink-200 hover:text-ink-100 hover:bg-ink-700/50'
                  )
                }
              >
                <Icon className="w-4 h-4" />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="pt-20 pb-28 px-6 max-w-[1440px] mx-auto w-full flex-1">
        <Outlet />
      </main>
    </div>
  );
}
