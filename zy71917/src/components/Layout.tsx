import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Clock, ClipboardCheck, Download } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
  projectName?: string;
}

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Home' },
  { to: '/timeline', icon: Clock, label: 'Timeline' },
  { to: '/checklist', icon: ClipboardCheck, label: 'Checklist' },
  { to: '/export', icon: Download, label: 'Export' },
];

export default function Layout({ children, projectName }: LayoutProps) {
  return (
    <div className="flex h-screen bg-[#1A1A2E] font-['Noto_Sans_SC'] text-gray-200">
      <aside className="flex w-16 flex-col items-center gap-2 bg-[#16213E] py-4">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `group relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
                isActive
                  ? 'bg-[#FF6B35] text-white'
                  : 'text-gray-400 hover:bg-[#0F3460] hover:text-white'
              }`
            }
          >
            <Icon size={20} />
            <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded bg-[#0F3460] px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
              {label}
            </span>
          </NavLink>
        ))}
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-12 shrink-0 items-center gap-3 border-b border-[#0F3460] bg-[#16213E] px-6">
          {projectName ? (
            <>
              <span className="font-['JetBrains_Mono'] text-sm font-semibold text-[#FF6B35]">
                {projectName}
              </span>
              <span className="text-gray-600">/</span>
            </>
          ) : null}
          <span className="text-sm text-gray-400">播客字幕对齐工作台</span>
        </header>

        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
