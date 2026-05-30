import { Bell, Search, User, Settings } from 'lucide-react';
import { useValuationStore } from '../../store/useValuationStore';
import { useShallow } from 'zustand/react/shallow';

export function Header() {
  const { currentUser, getStats } = useValuationStore(useShallow((state) => ({
    currentUser: state.currentUser,
    getStats: state.getStats,
  })));
  const stats = getStats();
  
  return (
    <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center gap-4">
        <h1 className="font-serif text-xl font-semibold text-navy-900">
          私募基金侧袋估值系统
        </h1>
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-200">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="搜索基金名称、代码..."
            className="bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none w-60"
          />
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="hidden lg:flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse-soft" />
            待确认: {stats.pendingCount} 条
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 text-rose-700 rounded-lg">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            异常: {stats.anomalyCount} 条
          </div>
        </div>
        
        <button className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-colors">
          <Bell className="w-5 h-5" />
          {stats.pendingCount + stats.anomalyCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white text-xs rounded-full flex items-center justify-center">
              {stats.pendingCount + stats.anomalyCount}
            </span>
          )}
        </button>
        
        <button className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-colors">
          <Settings className="w-5 h-5" />
        </button>
        
        <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-navy-100 flex items-center justify-center">
            <User className="w-4 h-4 text-navy-600" />
          </div>
          <div className="hidden sm:block">
            <div className="text-sm font-medium text-slate-800">{currentUser}</div>
            <div className="text-xs text-slate-500">估值核算岗</div>
          </div>
        </div>
      </div>
    </header>
  );
}
