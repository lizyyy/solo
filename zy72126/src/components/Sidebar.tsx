import { Upload, List, MessageSquare, AlertTriangle, Download, Music } from 'lucide-react';
import { useAppStore } from '@/store';
import { cn } from '@/lib/utils';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

export const Sidebar = () => {
  const { currentPage, setCurrentPage, channelTable, tracks, conflicts } = useAppStore();
  
  const pendingConflicts = conflicts.filter((c) => c.status === 'pending').length;
  const errorTracks = tracks.filter((t) => t.status === 'error').length;

  const navItems: NavItem[] = [
    { id: 'import', label: '导入面板', icon: <Upload size={20} /> },
    { id: 'tracks', label: '曲目台账', icon: <List size={20} />, badge: tracks.length },
    { id: 'annotations', label: '批注中心', icon: <MessageSquare size={20} /> },
    { 
      id: 'conflicts', 
      label: '冲突审核', 
      icon: <AlertTriangle size={20} />, 
      badge: pendingConflicts 
    },
    { id: 'export', label: '导出报告', icon: <Download size={20} /> },
  ];

  return (
    <aside className="w-64 min-h-screen bg-olive-900 text-white flex flex-col shadow-card">
      <div className="p-6 border-b border-olive-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center">
            <Music size={24} className="text-olive-900" />
          </div>
          <div>
            <h1 className="font-serif font-semibold text-lg">版权追踪</h1>
            <p className="text-xs text-olive-300">音乐分成管理</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setCurrentPage(item.id)}
            className={cn(
              'w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-200',
              currentPage === item.id
                ? 'bg-amber-500 text-olive-900 font-medium shadow-md'
                : 'text-olive-100 hover:bg-olive-800 hover:text-white'
            )}
          >
            <div className="flex items-center gap-3">
              {item.icon}
              <span>{item.label}</span>
            </div>
            {item.badge !== undefined && item.badge > 0 && (
              <span
                className={cn(
                  'px-2 py-0.5 text-xs rounded-full font-medium',
                  currentPage === item.id
                    ? 'bg-olive-900 text-amber-500'
                    : item.id === 'conflicts'
                    ? 'bg-brick-600 text-white'
                    : 'bg-olive-700 text-olive-100'
                )}
              >
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-olive-800">
        <div className="bg-olive-800 rounded-lg p-4">
          <p className="text-xs text-olive-300 mb-2">数据概览</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-2xl font-serif font-semibold text-amber-400">{channelTable.length}</p>
              <p className="text-xs text-olive-300">通道表</p>
            </div>
            <div>
              <p className="text-2xl font-serif font-semibold text-olive-200">{tracks.length}</p>
              <p className="text-xs text-olive-300">总曲目</p>
            </div>
            <div>
              <p className="text-2xl font-serif font-semibold text-brick-400">{errorTracks}</p>
              <p className="text-xs text-olive-300">异常项</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
