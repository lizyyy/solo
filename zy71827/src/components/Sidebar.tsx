import { NavLink } from 'react-router-dom';
import {
  Mountain,
  Home,
  Settings,
  Trophy,
  Gift,
  FileBarChart,
  SearchX,
} from 'lucide-react';
import { cn } from '@/utils/helpers';

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { path: '/', label: '首页', icon: Home },
  { path: '/drop-config', label: '掉落配置', icon: Settings },
  { path: '/leaderboard', label: '排行榜', icon: Trophy },
  { path: '/rewards', label: '奖励记录', icon: Gift },
  { path: '/review', label: '活动复盘', icon: FileBarChart },
  { path: '/missed', label: '漏发追踪', icon: SearchX },
];

interface SidebarProps {
  className?: string;
}

export default function Sidebar({ className }: SidebarProps) {
  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-screen w-60 flex flex-col bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white border-r border-slate-700/50',
        className
      )}
    >
      <div className="relative h-20 flex items-center gap-3 px-6 border-b border-slate-700/50 overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <svg className="w-full h-full" viewBox="0 0 240 80" preserveAspectRatio="none">
            <path
              d="M0,80 L40,40 L60,55 L90,20 L120,50 L150,30 L180,60 L210,35 L240,55 L240,80 Z"
              fill="url(#snowGradient)"
            />
            <defs>
              <linearGradient id="snowGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="100%" stopColor="#94a3b8" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div className="relative z-10 flex items-center gap-3">
          <div className="p-2 bg-sky-500/20 rounded-lg backdrop-blur-sm">
            <Mountain className="w-6 h-6 text-sky-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-sky-300 to-cyan-200 bg-clip-text text-transparent">
              雪山救援小队
            </h1>
            <p className="text-xs text-slate-400">奖励管理系统</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 py-4 px-3 overflow-y-auto">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 group',
                    isActive
                      ? 'bg-sky-500/20 text-sky-300 shadow-lg shadow-sky-500/10'
                      : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                  )
                }
              >
                {({ isActive }) => {
                  const Icon = item.icon;
                  return (
                    <>
                      <Icon
                        className={cn(
                          'w-5 h-5 transition-colors duration-200',
                          isActive ? 'text-sky-400' : 'text-slate-400 group-hover:text-slate-300'
                        )}
                      />
                      <span>{item.label}</span>
                      {isActive && (
                        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                      )}
                    </>
                  );
                }}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="p-4 border-t border-slate-700/50">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>版本 v1.0.0</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
        </div>
      </div>
    </aside>
  );
}
