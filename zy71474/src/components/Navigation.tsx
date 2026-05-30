import { NavLink } from 'react-router-dom';
import { Atom, FolderOpen, Shield } from 'lucide-react';
import { useStore } from '@/store/useStore';

const navItems = [
  { to: '/', icon: Atom, label: '碰撞模拟台' },
  { to: '/samples', icon: FolderOpen, label: '样例管理' },
  { to: '/audit', icon: Shield, label: '审计证据' },
];

export default function Navigation() {
  const experiments = useStore((s) => s.experiments);

  return (
    <nav className="w-56 h-screen bg-brand-bg border-r border-brand-border flex flex-col">
      <div className="px-4 py-6">
        <h1 className="font-display text-brand-cyan text-glow-cyan text-lg leading-tight">
          多球碰撞<br />能量台
        </h1>
      </div>

      <div className="flex-1 px-2 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-body transition-colors ${
                isActive
                  ? 'bg-brand-card border-l-2 border-brand-cyan text-brand-text'
                  : 'text-brand-muted hover:text-brand-text hover:bg-brand-surface'
              }`
            }
          >
            <item.icon size={18} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>

      <div className="px-4 py-4 border-t border-brand-border">
        <p className="text-xs text-brand-muted font-body">
          实验记录
        </p>
        <p className="font-display text-brand-cyan text-lg mt-1">
          {experiments.length}
        </p>
      </div>
    </nav>
  );
}
