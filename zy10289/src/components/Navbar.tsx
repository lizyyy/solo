'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { path: '/', label: '仪表盘', icon: '📊' },
  { path: '/props', label: '道具管理', icon: '🎬' },
  { path: '/crews', label: '拍摄组', icon: '👥' },
  { path: '/rentals', label: '租借记录', icon: '📋' },
  { path: '/calendar', label: '日历视图', icon: '📅' },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="bg-slate-800 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-2">
            <span className="text-2xl">📷</span>
            <span className="font-bold text-xl">摄影棚道具租借台</span>
          </div>
          <div className="flex space-x-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                className={`px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors ${
                  pathname === item.path
                    ? 'bg-slate-600 text-white'
                    : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
