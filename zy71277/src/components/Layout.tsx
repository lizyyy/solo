import { NavLink, useLocation } from 'react-router-dom';
import { AudioWaveform, Activity, AlertTriangle, FileBarChart, Menu, X } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { cn } from '../lib/utils';

interface LayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { path: '/', label: '分析工作台', icon: AudioWaveform },
  { path: '/', label: '漂移分析', icon: Activity },
  { path: '/', label: '错因追踪', icon: AlertTriangle },
  { path: '/reports', label: '报告中心', icon: FileBarChart },
];

export default function Layout({ children }: LayoutProps) {
  const { isSidebarOpen, setIsSidebarOpen } = useAppStore();
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex h-screen w-full bg-charcoal-900 text-white overflow-hidden">
      <aside
        className={cn(
          'flex flex-col bg-charcoal-800 border-r border-charcoal-700 transition-all duration-300 ease-in-out',
          isSidebarOpen ? 'w-64' : 'w-16'
        )}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-charcoal-700">
          {isSidebarOpen && (
            <h1 className="font-display text-xl text-cyan-300 whitespace-nowrap">
              节拍漂移估计器
            </h1>
          )}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={cn(
              'p-2 rounded-lg hover:bg-charcoal-700 transition-colors text-charcoal-300 hover:text-cyan-300',
              !isSidebarOpen && 'mx-auto'
            )}
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="flex-1 py-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <NavLink
                key={item.label}
                to={item.path}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 mx-2 rounded-lg transition-all duration-200',
                  'hover:bg-charcoal-700 hover:text-cyan-300',
                  active
                    ? 'bg-charcoal-700 text-cyan-300 border-l-2 border-cyan-300'
                    : 'text-charcoal-300 border-l-2 border-transparent',
                  !isSidebarOpen && 'justify-center px-0'
                )}
              >
                <Icon size={20} className="flex-shrink-0" />
                {isSidebarOpen && (
                  <span className="whitespace-nowrap">{item.label}</span>
                )}
              </NavLink>
            );
          })}
        </nav>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}
