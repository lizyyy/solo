import { LayoutDashboard, FileText, Zap, ClipboardList, Calendar, AlertTriangle } from 'lucide-react';
import type { ViewType } from '../types';

interface SidebarProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  pendingCount: number;
  badDataCount: number;
}

const menuItems: { id: ViewType; label: string; icon: typeof LayoutDashboard; badge?: string }[] = [
  { id: 'dashboard', label: '项目经理看板', icon: LayoutDashboard },
  { id: 'bimNotes', label: 'BIM模型备注', icon: FileText },
  { id: 'collisions', label: '碰撞点追踪', icon: Zap },
  { id: 'tracking', label: '施工变更材料追踪', icon: ClipboardList },
  { id: 'review', label: '月底复核', icon: Calendar },
  { id: 'badData', label: '坏数据中心', icon: AlertTriangle, badge: 'bad' },
];

export default function Sidebar({ currentView, onViewChange, pendingCount, badDataCount }: SidebarProps) {
  return (
    <aside className="w-64 bg-slate-800 text-white min-h-screen flex flex-col">
      <div className="p-5 border-b border-slate-700">
        <h1 className="text-lg font-semibold text-slate-100">施工变更管理系统</h1>
        <p className="text-xs text-slate-400 mt-1">BIM · 碰撞 · 材料追踪</p>
      </div>
      
      <nav className="flex-1 py-4">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          const showBadge = item.badge === 'bad' && badDataCount > 0;
          const showPending = item.id === 'tracking' && pendingCount > 0;
          
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`w-full flex items-center gap-3 px-5 py-3 text-left transition-colors ${
                isActive
                  ? 'bg-slate-700 text-white border-r-4 border-blue-500'
                  : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
              }`}
            >
              <Icon size={18} className={isActive ? 'text-blue-400' : 'text-slate-400'} />
              <span className="text-sm flex-1">{item.label}</span>
              {showBadge && (
                <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">
                  {badDataCount}
                </span>
              )}
              {showPending && (
                <span className="text-xs bg-amber-500 text-white px-2 py-0.5 rounded-full">
                  {pendingCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>
      
      <div className="p-4 border-t border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-sm font-medium">
            赵
          </div>
          <div>
            <p className="text-sm font-medium">建筑师 小赵</p>
            <p className="text-xs text-slate-400">周一早会 · 待复核3项</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
