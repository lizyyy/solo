import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { 
  Upload, 
  Grid3X3, 
  Search, 
  History, 
  AlertTriangle,
  FileBarChart
} from 'lucide-react';
import { useStore } from '@/store/useStore';

export default function Layout() {
  const navigate = useNavigate();
  const { changes, currentPack } = useStore();

  const navItems = [
    { path: '/', label: '材料导入', icon: Upload },
    { path: '/matrix', label: '矩阵分析', icon: Grid3X3 },
    { path: '/trace', label: '溯源详情', icon: Search },
    { path: '/versions', label: '版本对比', icon: History },
  ];

  return (
    <div className="flex h-screen bg-slate-50">
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
              <FileBarChart className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-slate-800">矩阵变换演示</h1>
              <p className="text-xs text-slate-500">教研错题分析系统</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                `nav-item ${isActive ? 'nav-item-active' : ''}`
              }
              onClick={(e) => {
                if (path === '/trace') {
                  e.preventDefault();
                }
              }}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{label}</span>
              {path === '/versions' && changes.length > 0 && (
                <span className="ml-auto flex items-center justify-center w-5 h-5 bg-warning-500 text-white text-xs rounded-full">
                  {changes.length}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {changes.length > 0 && (
          <div className="p-4 m-4 bg-warning-50 rounded-lg border border-warning-200">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-warning-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-warning-800">检测到版本变更</p>
                <p className="text-warning-600 mt-1">
                  共 {changes.length} 处变动，前往版本对比查看详情
                </p>
              </div>
            </div>
          </div>
        )}

        {currentPack && (
          <div className="p-4 border-t border-slate-100">
            <p className="text-xs text-slate-500">当前材料包</p>
            <p className="font-medium text-slate-700 truncate">{currentPack.name}</p>
            <p className="text-xs text-slate-500 mt-1">
              {currentPack.records.length} 条记录 · v{currentPack.version}
            </p>
          </div>
        )}
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
