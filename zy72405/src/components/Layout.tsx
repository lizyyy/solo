import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import {
  ListTodo,
  Upload,
  Music2,
  BookOpen,
  Disc3,
  User,
  Settings
} from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

const navItems = [
  { path: '/', label: '缺货提醒', icon: ListTodo },
  { path: '/import', label: '合同导入', icon: Upload },
  { path: '/aliases', label: '曲目别名表', icon: Music2 },
  { path: '/rules', label: '边界规则', icon: BookOpen },
];

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const currentUser = useStore(state => state.currentUser);
  const setCurrentUser = useStore(state => state.setCurrentUser);
  const resetToMockData = useStore(state => state.resetToMockData);

  const roleLabels: Record<string, string> = {
    music_teacher: '音乐老师',
    tour_coordinator: '巡演统筹',
    operator: '运营'
  };

  return (
    <div className="min-h-screen bg-stone-50 flex">
      <aside className="w-60 bg-stone-900 text-white flex flex-col">
        <div className="p-5 border-b border-stone-700">
          <Link to="/" className="flex items-center gap-3">
            <Disc3 className="w-7 h-7 text-amber-500" />
            <div>
              <h1 className="font-bold text-lg tracking-tight">黑胶预售</h1>
              <p className="text-xs text-stone-400">缺货提醒系统</p>
            </div>
          </Link>
        </div>

        <nav className="flex-1 p-3">
          <ul className="space-y-1">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                      isActive
                        ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20'
                        : 'text-stone-300 hover:bg-stone-800 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-3 border-t border-stone-700">
          <div className="px-3 py-2 rounded-lg bg-stone-800">
            <div className="flex items-center gap-2 mb-2">
              <User className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-medium">{currentUser.name}</span>
            </div>
            <select
              value={currentUser.role}
              onChange={(e) => setCurrentUser({
                ...currentUser,
                role: e.target.value as 'music_teacher' | 'tour_coordinator' | 'operator'
              })}
              className="w-full text-xs bg-stone-700 border border-stone-600 rounded px-2 py-1 text-stone-200"
            >
              <option value="music_teacher">音乐老师</option>
              <option value="tour_coordinator">巡演统筹</option>
              <option value="operator">运营</option>
            </select>
          </div>

          <button
            onClick={resetToMockData}
            className="w-full mt-2 px-3 py-2 text-xs text-stone-400 hover:text-stone-200 hover:bg-stone-800 rounded-lg transition-colors flex items-center gap-2"
          >
            <Settings className="w-3.5 h-3.5" />
            重置演示数据
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
