import { Bell, Search, User, Upload, RefreshCw } from 'lucide-react';
import { useSessionStore } from '@/store/sessionStore';
import { useState } from 'react';

export default function Header() {
  const { currentSession, reprocessAnomalies, isLoading } = useSessionStore();
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <header className="h-16 bg-dark-700/50 backdrop-blur-md border-b border-dark-600 flex items-center justify-between px-6 sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" />
          <input
            type="text"
            placeholder="搜索会话、异常点..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-72 h-9 pl-10 pr-4 bg-dark-800 border border-dark-600 rounded-lg text-sm text-dark-100 placeholder-dark-400 focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/30 transition-all"
          />
        </div>

        {currentSession && (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-dark-400">当前会话:</span>
            <span className="font-medium text-dark-100">{currentSession.sessionName}</span>
            <span className="px-2 py-0.5 rounded text-xs bg-success-500/20 text-success-400">
              {currentSession.status === 'ready' ? '已就绪' : '处理中'}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={reprocessAnomalies}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-800 border border-dark-600 text-sm text-dark-200 hover:bg-dark-700 hover:border-dark-500 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          重新分析
        </button>

        <button className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary-500 text-sm text-white hover:bg-primary-600 transition-all btn-glow">
          <Upload className="w-4 h-4" />
          导入数据
        </button>

        <button className="relative p-2 rounded-lg hover:bg-dark-700 transition-all">
          <Bell className="w-5 h-5 text-dark-300" />
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-danger-500" />
        </button>

        <div className="w-px h-6 bg-dark-600" />

        <button className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-dark-700 transition-all">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center">
            <User className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm text-dark-200">分析员</span>
        </button>
      </div>
    </header>
  );
}
