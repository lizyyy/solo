import React from 'react';
import { NavLink, useLocation, Outlet } from 'react-router-dom';
import { Upload, FileCheck, FileText, History, Music2 } from 'lucide-react';

const navItems = [
  { path: '/import', label: '材料导入', icon: Upload },
  { path: '/review', label: '材料核对', icon: FileCheck },
  { path: '/report', label: '周报生成', icon: FileText },
  { path: '/history', label: '历史记录', icon: History },
];

export default function Layout() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-studio-bg text-studio-text flex">
      <aside className="w-56 bg-studio-surface border-r border-white/10 flex flex-col shrink-0">
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-studio-amber flex items-center justify-center">
              <Music2 className="w-5 h-5 text-studio-bg" />
            </div>
            <div>
              <h1 className="font-serif font-bold text-white text-base">钢琴陪练周报</h1>
              <p className="text-xs text-white/50">给老许的小工具</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200
                  ${isActive 
                    ? 'bg-studio-amber text-studio-bg font-medium shadow-md' 
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="text-xs text-white/40">
            数据存在本地浏览器里，换电脑记得导出
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-studio-surface/50 border-b border-white/10 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-white/60 text-sm">
              {navItems.find(n => n.path === location.pathname)?.label}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <OperatorBadge />
          </div>
        </header>

        <div className="flex-1 overflow-auto">
          <div className="container py-6 animate-fade-in-up">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}

function OperatorBadge() {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full">
      <div className="w-6 h-6 rounded-full bg-studio-amber/20 flex items-center justify-center">
        <span className="text-xs font-medium text-studio-amber">许</span>
      </div>
      <span className="text-white/80 text-sm">老许</span>
    </div>
  );
}
