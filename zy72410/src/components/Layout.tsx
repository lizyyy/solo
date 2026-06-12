import type { ReactNode } from 'react';
import { useStore } from '../store/useStore';
import Notification from './Notification';

interface LayoutProps {
  children: ReactNode;
}

const navItems = [
  { id: 'import', label: '授权期限导入', icon: '📥' },
  { id: 'messages', label: '调音师留言补录', icon: '📝' },
  { id: 'materials', label: '素材入库管理', icon: '🎵' },
  { id: 'changes', label: '排练变更记录', icon: '📋' },
  { id: 'selfcheck', label: '四项自检', icon: '🔍' },
  { id: 'report', label: '结果报告', icon: '📊' },
];

export default function Layout({ children }: LayoutProps) {
  const { activeTab, setActiveTab, pendingConflicts } = useStore();
  const pendingCount = pendingConflicts.length;

  return (
    <div className="min-h-screen bg-studio-black flex flex-col">
      <Notification />
      
      <header className="bg-studio-dark border-b border-studio-gray sticky top-0 z-40">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 vinyl-bg rounded-full flex items-center justify-center">
                  <div className="w-3 h-3 bg-studio-gold rounded-full" />
                </div>
                <div>
                  <h1 className="text-xl font-display text-studio-gold">影视配乐素材入库系统</h1>
                  <p className="text-xs text-studio-silver font-mono">SOUNDTRACK MANAGEMENT</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-studio-darker rounded-lg">
                <div className="w-2 h-2 bg-status-new rounded-full animate-pulse" />
                <span className="text-sm font-mono text-studio-silver">系统运行正常</span>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-white">当前用户</p>
                <p className="text-xs text-studio-gold font-mono">版权运营</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        <nav className="w-64 bg-studio-darker border-r border-studio-gray flex-shrink-0">
          <div className="p-4">
            <ul className="space-y-1">
              {navItems.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 text-left ${
                      activeTab === item.id
                        ? 'bg-studio-gold text-studio-black font-semibold'
                        : 'text-studio-silver hover:bg-studio-gray hover:text-white'
                    }`}
                  >
                    <span className="text-lg">{item.icon}</span>
                    <span className="font-mono text-sm">{item.label}</span>
                    {item.id === 'messages' && pendingCount > 0 && (
                      <span className="ml-auto bg-studio-red text-white text-xs px-2 py-0.5 rounded-full">
                        {pendingCount}
                      </span>
                    )}
                    {item.id === 'selfcheck' && (
                      <span className="ml-auto text-xs">4项</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="absolute bottom-4 left-4 right-4">
            <div className="card-studio p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex gap-0.5">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="waveform-bar" style={{ animationDelay: `${i * 0.2}s` }} />
                  ))}
                </div>
                <span className="text-xs font-mono text-studio-gold">LIVE MONITOR</span>
              </div>
              <div className="text-xs text-studio-silver space-y-1">
                <p>版本: v1.0.0</p>
                <p>数据库: SQLite</p>
                <p>工作目录: /data</p>
              </div>
            </div>
          </div>
        </nav>

        <main className="flex-1 p-6 overflow-auto">
          <div className="container mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
