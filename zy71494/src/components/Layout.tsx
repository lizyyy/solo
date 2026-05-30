import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Music, List, History, HelpCircle, Settings } from 'lucide-react';

const Layout: React.FC = () => {
  const navItems = [
    { to: '/', icon: Music, label: '歌单总览' },
    { to: '/history', icon: History, label: '操作历史' },
    { to: '/guide', icon: HelpCircle, label: '快速上手' },
  ];

  return (
    <div className="flex h-screen bg-bg-primary text-text-primary overflow-hidden">
      <aside className="w-64 bg-bg-secondary border-r border-bg-tertiary flex flex-col">
        <div className="p-6 border-b border-bg-tertiary">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <span className="text-accent-cyan">🎵</span>
            <span>DJ过渡拍点助手</span>
          </h1>
          <p className="text-sm text-text-muted mt-1">专业歌单过渡分析工具</p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'bg-accent-cyan/20 text-accent-cyan shadow-glow'
                    : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
                }`
              }
            >
              <item.icon size={20} />
              <span className="font-medium">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-bg-tertiary">
          <div className="text-xs text-text-muted">
            <p>数据存储在浏览器本地</p>
            <p>请定期导出备份重要数据</p>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
