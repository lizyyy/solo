import { Bell, Search, User } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

export default function TopBar() {
  const { anomalies } = useAppStore();
  const pendingCount = anomalies.filter(a => a.status === 'pending').length;

  return (
    <header className="h-16 bg-white border-b border-ocean-100 flex items-center justify-between px-6 shadow-sm">
      <div className="flex items-center gap-4">
        <h1 className="font-serif text-xl font-semibold text-ocean-800">
          海洋牧场异常预警系统
        </h1>
        <span className="badge bg-alert-orange/10 text-alert-orange text-xs">
          社区公示版
        </span>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ocean-400" />
          <input
            type="text"
            placeholder="搜索点位、材料、异常..."
            className="w-64 pl-9 pr-4 py-2 text-sm bg-ocean-50 border border-ocean-200 rounded-md
                       focus:outline-none focus:border-ocean-400 focus:ring-1 focus:ring-ocean-300
                       transition-colors placeholder:text-ocean-400"
          />
        </div>

        <button className="relative p-2 text-ocean-500 hover:text-ocean-700 hover:bg-ocean-50 rounded-md transition-colors">
          <Bell className="w-5 h-5" />
          {pendingCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-alert-orange rounded-full animate-pulse" />
          )}
        </button>

        <div className="h-6 w-px bg-ocean-200" />

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-ocean-100 rounded-full flex items-center justify-center">
            <User className="w-4 h-4 text-ocean-600" />
          </div>
          <div className="text-sm">
            <div className="font-medium text-ocean-800">水质分析师</div>
            <div className="text-xs text-ocean-500">阿乔</div>
          </div>
        </div>
      </div>
    </header>
  );
}
