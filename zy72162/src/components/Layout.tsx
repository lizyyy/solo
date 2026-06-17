import { NavLink, useLocation } from 'react-router-dom';
import { 
  MapPin, 
  Upload, 
  FileCheck, 
  FileSpreadsheet, 
  Clock, 
  HelpCircle,
  Trash2,
  User
} from 'lucide-react';
import { useAppStore } from '@/store';
import { cn } from '@/utils/cn';

const navItems = [
  { path: '/', label: '点位管理', icon: MapPin },
  { path: '/import', label: '数据导入', icon: Upload },
  { path: '/review', label: '人工复核', icon: FileCheck },
  { path: '/export', label: '公示导出', icon: FileSpreadsheet },
  { path: '/logs', label: '操作日志', icon: Clock },
  { path: '/help', label: '使用说明', icon: HelpCircle },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { getStats, operator, setOperator, clearAllData, loadMockData } = useAppStore();
  const stats = getStats();

  const handleResetData = () => {
    if (confirm('确定要清空所有数据吗？此操作不可恢复。')) {
      clearAllData().then(() => {
        loadMockData();
      });
    }
  };

  return (
    <div className="flex h-screen bg-neutral-50">
      <aside className="w-60 bg-white border-r border-neutral-200 flex flex-col">
        <div className="p-4 border-b border-neutral-200">
          <h1 className="text-xl font-serif font-bold text-primary-600 tracking-wide">
            垃圾分类投放热力
          </h1>
          <p className="text-xs text-neutral-500 mt-1">数据校对与公示管理
          </p>
        </div>

        <div className="p-3 bg-primary-50 border-b border-primary-100">
          <div className="grid grid-cols-2 gap-2">
            <div className="text-center p-2">
              <div className="text-lg font-bold text-primary-600">{stats.total}</div>
              <div className="text-xs text-neutral-500">总点位</div>
            </div>
            <div className="text-center p-2">
              <div className="text-lg font-bold text-success-600">{stats.confirmed}</div>
              <div className="text-xs text-neutral-500">已确认</div>
            </div>
            <div className="text-center p-2">
              <div className="text-lg font-bold text-warning-600">{stats.pending}</div>
              <div className="text-xs text-neutral-500">待处理</div>
            </div>
            <div className="text-center p-2">
              <div className="text-lg font-bold text-danger-600">{stats.conflict}</div>
              <div className="text-xs text-neutral-500">有冲突</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 overflow-y-auto">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              
              let badge = null;
              if (item.path === '/review' && stats.pendingReview > 0) {
                badge = (
                  <span className="bg-danger-500 text-white text-xs px-1.5 py-0.5 rounded-sm">
                    {stats.pendingReview}
                  </span>
                );
              }

              return (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-sm transition-all duration-200',
                      isActive
                        ? 'bg-primary-50 text-primary-700 border-l-2 border-primary-500 font-medium'
                        : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
                    )}
                  >
                    <Icon size={18} strokeWidth={2} />
                    <span className="flex-1 text-sm">{item.label}</span>
                    {badge}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-3 border-t border-neutral-200 bg-neutral-50">
          <div className="flex items-center gap-2 px-2 py-2">
            <div className="w-8 h-8 bg-primary-100 rounded-sm flex items-center justify-center">
              <User size={16} className="text-primary-600" />
            </div>
            <div className="flex-1 min-w-0">
              <input
                type="text"
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
                className="text-sm font-medium text-neutral-700 bg-transparent border-none focus:outline-none w-full"
                placeholder="操作人"
              />
            </div>
          </div>
          
          <button
            onClick={handleResetData}
            className="w-full mt-2 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs text-neutral-500 hover:text-danger-600 hover:bg-danger-50 rounded-sm transition-colors"
          >
            <Trash2 size={14} />
            重置示例数据
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 bg-white border-b border-neutral-200 px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-serif font-semibold text-neutral-800">
              {navItems.find(n => n.path === location.pathname)?.label || '点位管理'}
            </h2>
          </div>
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <span className="inline-block w-2 h-2 bg-success-500 rounded-full animate-pulse" />
            数据本地运行中
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
