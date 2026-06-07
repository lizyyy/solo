import React from 'react';
import {
  Music,
  FileCheck,
  ShieldCheck,
  FileText,
  UserCheck,
  BarChart3,
} from 'lucide-react';
import { useAppStore } from '../store/AppStore';
import type { PageType } from '../types';

interface NavItem {
  id: PageType;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

export const Sidebar: React.FC = () => {
  const { currentPage, setCurrentPage, complianceChecks, substituteSongs } = useAppStore();

  const pendingReviewCount = complianceChecks.filter(
    c => c.status === 'needs_review' || c.status === 'pending'
  ).length;
  const pendingSubstituteCount = substituteSongs.filter(
    s => s.status === 'pending_review'
  ).length;

  const navItems: NavItem[] = [
    { id: 'audio_remarks', label: '音频文件备注', icon: <Music size={20} /> },
    { id: 'authorization', label: '授权期限页', icon: <FileCheck size={20} /> },
    {
      id: 'compliance_check',
      label: '电台歌单合规检查',
      icon: <ShieldCheck size={20} />,
      badge: pendingReviewCount,
    },
    { id: 'settlement', label: '分账明细', icon: <FileText size={20} /> },
    {
      id: 'substitute_review',
      label: '临时替补复核',
      icon: <UserCheck size={20} />,
      badge: pendingSubstituteCount,
    },
    { id: 'compliance_chart', label: '图表展示', icon: <BarChart3 size={20} /> },
  ];

  return (
    <div className="w-64 bg-slate-900 text-white min-h-screen flex flex-col">
      <div className="p-6 border-b border-slate-700">
        <h1 className="text-xl font-bold">巡演歌单管理</h1>
        <p className="text-sm text-slate-400 mt-1">电台合规检查系统</p>
      </div>
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navItems.map(item => (
            <li key={item.id}>
              <button
                onClick={() => setCurrentPage(item.id)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
                  currentPage === item.id
                    ? 'bg-primary-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  {item.icon}
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
                {item.badge && item.badge > 0 && (
                  <span className="bg-danger-500 text-white text-xs px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div className="p-4 border-t border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center font-bold">
            阿
          </div>
          <div>
            <p className="text-sm font-medium">阿梅</p>
            <p className="text-xs text-slate-400">巡演统筹</p>
          </div>
        </div>
      </div>
    </div>
  );
};
