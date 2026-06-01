import { Bell, User, Clock } from 'lucide-react';
import { useAppStore } from '@/store/appStore';

export function Header() {
  const currentBatch = useAppStore((state) => state.getCurrentBatch());

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <h2 className="text-xl font-bold text-slate-800">
          {currentBatch?.name || '图神经网络社区解释'}
        </h2>
        <span className="flex items-center gap-1 text-sm text-slate-500">
          <Clock className="w-4 h-4" />
          {currentBatch?.createdAt
            ? new Date(currentBatch.createdAt).toLocaleDateString('zh-CN')
            : ''}
        </span>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative">
          <Bell className="w-5 h-5 text-slate-500 cursor-pointer hover:text-slate-700 transition-colors" />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
            3
          </span>
        </div>
        <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
          <div className="w-9 h-9 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
            周
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700">周姐</p>
            <p className="text-xs text-slate-500">调度主管</p>
          </div>
          <User className="w-5 h-5 text-slate-400" />
        </div>
      </div>
    </header>
  );
}
