import React from 'react';
import {
  LayoutDashboard,
  Image,
  Zap,
  FileText,
  AlertTriangle,
  User,
  Settings,
} from 'lucide-react';
import { UserRole } from '@/types';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  currentUser: { name: string; role: UserRole };
  onSwitchUser: () => void;
  unconfirmedCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  currentUser,
  onSwitchUser,
  unconfirmedCount,
}) => {
  const menuItems = [
    { id: 'overview', label: '总览', icon: LayoutDashboard },
    { id: 'artworks', label: '作品管理', icon: Image },
    { id: 'flash-loans', label: '快闪借调', icon: Zap },
    { id: 'layout', label: '布展清单', icon: FileText },
    { id: 'anomalies', label: '异常处理', icon: AlertTriangle, badge: unconfirmedCount },
  ];

  return (
    <div className="w-64 bg-gray-900 text-white min-h-screen flex flex-col">
      <div className="p-6 border-b border-gray-800">
        <h1 className="text-xl font-bold">展览管理系统</h1>
        <p className="text-gray-400 text-sm mt-1">布展清单与借调</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {menuItems.map(item => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === item.id
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <item.icon size={20} />
            <span>{item.label}</span>
            {item.badge && item.badge > 0 && (
              <span className="ml-auto bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-800">
        <div className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg">
          <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
            <User size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{currentUser.name}</p>
            <p className="text-xs text-gray-400">
              {currentUser.role === 'curator' ? '策展人' : '画廊助理'}
            </p>
          </div>
          <button
            onClick={onSwitchUser}
            className="text-gray-400 hover:text-white transition-colors"
            title="切换用户"
          >
            <Settings size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
