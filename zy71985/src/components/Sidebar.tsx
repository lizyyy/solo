import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Database,
  CheckCircle2,
  History,
  FileOutput,
  Package,
} from 'lucide-react';
import { useAppStore } from '@/store';
import { useState } from 'react';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: '数据看板' },
  { path: '/records', icon: Database, label: '数据管理' },
  { path: '/review', icon: CheckCircle2, label: '复核修正' },
  { path: '/history', icon: History, label: '历史追溯' },
  { path: '/export', icon: FileOutput, label: '导出报告' },
];

export default function Sidebar() {
  const location = useLocation();
  const currentUser = useAppStore(state => state.currentUser);
  const setCurrentUser = useAppStore(state => state.setCurrentUser);
  const [showUserEdit, setShowUserEdit] = useState(false);
  const [userName, setUserName] = useState(currentUser);

  const handleUserSave = () => {
    if (userName.trim()) {
      setCurrentUser(userName.trim());
    }
    setShowUserEdit(false);
  };

  return (
    <aside className="w-64 h-screen bg-slate-900 border-r border-slate-800 flex flex-col fixed left-0 top-0">
      <div className="p-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
            <Package className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg font-mono">库存预占释放</h1>
            <p className="text-slate-500 text-xs">v1.0.0</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                isActive
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-sm font-medium">{item.label}</span>
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800">
        {showUserEdit ? (
          <div className="space-y-2">
            <input
              type="text"
              value={userName}
              onChange={e => setUserName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
              placeholder="输入操作人姓名"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={handleUserSave}
                className="flex-1 px-3 py-1.5 bg-cyan-500 text-white text-xs rounded-lg hover:bg-cyan-600 transition-colors"
              >
                保存
              </button>
              <button
                onClick={() => {
                  setShowUserEdit(false);
                  setUserName(currentUser);
                }}
                className="flex-1 px-3 py-1.5 bg-slate-700 text-slate-300 text-xs rounded-lg hover:bg-slate-600 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => setShowUserEdit(true)}
            className="flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-800/50 cursor-pointer hover:bg-slate-800 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center">
              <span className="text-white text-xs font-bold">
                {currentUser.charAt(0)}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{currentUser}</p>
              <p className="text-slate-500 text-xs">点击修改操作人</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
