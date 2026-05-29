import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Layers, FileDown, History, Palette } from 'lucide-react';
import { useSelectedWorks } from '../../store/usePortfolioStore';

export default function Navbar() {
  const selectedWorks = useSelectedWorks();

  const navItems = [
    { to: '/', label: '分析看板', icon: LayoutDashboard },
    { to: '/portfolio', label: '组合评分', icon: Layers, badge: selectedWorks.length > 0 ? selectedWorks.length : null },
    { to: '/export', label: '报告导出', icon: FileDown },
    { to: '/history', label: '历史记录', icon: History },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-charcoal-800/90 backdrop-blur-xl">
      <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-ochre-400 to-ochre-600 flex items-center justify-center">
            <Palette className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-display text-lg font-semibold text-cream-200 tracking-tight">
              作品集筛选器
            </h1>
            <p className="text-xs text-cream-400/70 -mt-0.5">Portfolio Curator</p>
          </div>
        </div>

        <nav className="flex items-center gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `
                nav-link flex items-center gap-2
                ${isActive ? 'nav-link-active' : ''}
              `}
            >
              <item.icon className="w-4 h-4" />
              <span>{item.label}</span>
              {item.badge !== null && (
                <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-ochre-500/20 text-ochre-400 font-medium">
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="w-[140px] text-right">
          <p className="text-xs text-cream-400/60">
            <span className="text-ochre-400">{selectedWorks.length}</span> 件已选
          </p>
        </div>
      </div>
    </header>
  );
}
