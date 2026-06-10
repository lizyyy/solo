import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Box, AlertTriangle, History, Droplets, UserCheck, Bot, LucideIcon } from 'lucide-react';
import { useAppStore, UserRole } from '@/store/useAppStore';
import { cn } from '@/lib/utils';

interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

const navItems: NavItem[] = [
  { path: '/', label: '主控制台', icon: LayoutDashboard },
  { path: '/tracker', label: '追踪工作台', icon: Box },
  { path: '/collision', label: '碰撞中心', icon: AlertTriangle },
  { path: '/history', label: '历史与导出', icon: History },
];

export default function AppSidebar() {
  const { userRole, setUserRole } = useAppStore();

  const handleRoleSwitch = (role: UserRole) => {
    setUserRole(role);
  };

  return (
    <aside className="w-[220px] bg-engineering-blue min-h-screen flex flex-col text-white flex-shrink-0">
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center">
            <Droplets className="w-5 h-5 text-white" strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-[15px] font-semibold tracking-wide font-serif">屋面排水材料</h1>
            <p className="text-[11px] text-white/60 -mt-0.5">追踪系统</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all duration-200',
                isActive
                  ? 'bg-white/15 text-white shadow-sm'
                  : 'text-white/70 hover:bg-white/8 hover:text-white'
              )
            }
          >
            <item.icon className="w-[18px] h-[18px]" strokeWidth={1.8} />
            <span className="font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="px-3 pb-5 pt-3 border-t border-white/10">
        <p className="text-[11px] text-white/50 px-2 mb-2.5">当前角色</p>
        <div className="bg-white/8 rounded-lg p-1.5 flex gap-1">
          <button
            onClick={() => handleRoleSwitch('assistant')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs transition-all duration-200',
              userRole === 'assistant'
                ? 'bg-white text-engineering-blue shadow-sm font-medium'
                : 'text-white/70 hover:text-white hover:bg-white/8'
            )}
          >
            <Bot className="w-3.5 h-3.5" strokeWidth={2} />
            助理
          </button>
          <button
            onClick={() => handleRoleSwitch('reviewer')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs transition-all duration-200',
              userRole === 'reviewer'
                ? 'bg-white text-engineering-blue shadow-sm font-medium'
                : 'text-white/70 hover:text-white hover:bg-white/8'
            )}
          >
            <UserCheck className="w-3.5 h-3.5" strokeWidth={2} />
            复核人
          </button>
        </div>
      </div>
    </aside>
  );
}
