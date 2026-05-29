import { Link, Outlet, useLocation } from 'react-router-dom';
import { Ruler, Eye, Clock, FileText } from 'lucide-react';

const navItems = [
  { path: '/', label: '工作台', icon: Ruler },
  { path: '/preview', label: '展线预览', icon: Eye },
  { path: '/history', label: '历史记录', icon: Clock },
  { path: '/report', label: '布展报告', icon: FileText },
];

export default function Layout() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-[#FAFAF7] font-['Noto_Sans_SC',sans-serif]">
      <nav className="sticky top-0 z-10 border-b border-[#D4CFC4]/60 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-[#2C2C2C]">
              <Ruler size={16} className="text-[#FAFAF7]" strokeWidth={1.5} />
            </div>
            <span className="font-['Playfair_Display',serif] text-lg font-semibold tracking-wide text-[#2C2C2C]">
              展墙挂画高度器
            </span>
          </Link>

          <div className="flex items-center gap-1">
            {navItems.map((item) => {
              const isActive =
                item.path === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.path);
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`relative flex items-center gap-1.5 rounded-md px-4 py-2 text-sm transition-colors ${
                    isActive
                      ? 'text-[#C4623A]'
                      : 'text-[#2C2C2C]/60 hover:text-[#2C2C2C]'
                  }`}
                >
                  <Icon size={15} strokeWidth={1.5} />
                  <span>{item.label}</span>
                  {isActive && (
                    <span className="absolute bottom-0 left-4 right-4 h-[2px] bg-[#C4623A]" />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-6 py-6">
        <Outlet />
      </main>
    </div>
  );
}
