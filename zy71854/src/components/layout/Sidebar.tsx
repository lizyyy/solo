import React from 'react';
import { NavLink } from 'react-router-dom';
import { Database, Orbit, FileText, BookOpen, Sun } from 'lucide-react';
import { useAppStore } from '@/store';

export const Sidebar: React.FC = () => {
  const { undoLastOperation } = useAppStore();

  const navItems = [
    { path: '/', icon: Database, label: '数据管理' },
    { path: '/orbit', icon: Orbit, label: '轨道讲解' },
    { path: '/records', icon: FileText, label: '课堂记录' },
    { path: '/guide', icon: BookOpen, label: '操作指南' },
  ];

  const handleUndo = () => {
    const success = undoLastOperation();
    if (!success) {
      alert('没有可撤回的操作');
    }
  };

  return (
    <aside className="w-60 bg-space-deep min-h-screen flex flex-col animate-slide-left">
      <div className="p-6 border-b border-space-blue/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-star-gold to-star-light flex items-center justify-center">
            <Sun size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-white font-serif font-bold text-lg">太阳系轨道</h1>
            <p className="text-space-light text-xs">教学辅助工具</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `nav-item ${isActive ? 'active' : ''}`
            }
          >
            <item.icon size={20} />
            <span className="font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-space-blue/30">
        <button
          onClick={handleUndo}
          className="w-full px-4 py-2 bg-space-blue/50 text-space-light rounded-lg hover:bg-space-blue hover:text-white transition-all duration-200 flex items-center justify-center gap-2"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 7v6h6" />
            <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
          </svg>
          <span className="text-sm">撤回上一步</span>
        </button>
      </div>
    </aside>
  );
};
