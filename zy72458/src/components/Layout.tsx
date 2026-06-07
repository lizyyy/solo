import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FileText, 
  UserCheck, 
  ClipboardCheck, 
  Download,
  Users
} from 'lucide-react';
import { useAppStore } from '../store';

const menuItems = [
  { path: '/dashboard', label: '工作台', icon: LayoutDashboard },
  { path: '/complaints', label: '投诉列表', icon: FileText },
  { path: '/review', label: '复核视图', icon: UserCheck, role: 'secretary' as const },
  { path: '/self-check', label: '自检中心', icon: ClipboardCheck },
  { path: '/export', label: '数据导出', icon: Download },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { currentRole, currentUser, setRole } = useAppStore();

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="w-60 bg-slate-900 text-white flex flex-col">
        <div className="p-5 border-b border-slate-700">
          <h1 className="text-lg font-bold text-slate-100">菜市场摊位外溢治理</h1>
          <p className="text-xs text-slate-400 mt-1">城更项目管理系统</p>
        </div>

        <nav className="flex-1 py-4">
          {menuItems.map(item => {
            if (item.role && item.role !== currentRole) return null;
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-5 py-3 text-sm transition-colors ${
                  isActive 
                    ? 'bg-blue-600 text-white' 
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-700">
          <div className="text-xs text-slate-400 mb-2">当前身份</div>
          <div className="flex gap-2">
            <button
              onClick={() => setRole('manager')}
              className={`flex-1 py-2 px-3 rounded text-xs transition-colors ${
                currentRole === 'manager' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              阿宁（经理）
            </button>
            <button
              onClick={() => setRole('secretary')}
              className={`flex-1 py-2 px-3 rounded text-xs transition-colors ${
                currentRole === 'secretary' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              王书记
            </button>
          </div>
          <div className="mt-3 text-xs text-slate-500">
            登录用户：{currentUser}
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col">
        <header className="bg-white border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">
              {menuItems.find(m => m.path === location.pathname)?.label || '工作台'}
            </h2>
          </div>
        </header>
        <div className="flex-1 p-6 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
