import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Home,
  FileUp,
  ClipboardCheck,
  AlertTriangle,
  BarChart3,
  Download,
  BookOpen
} from 'lucide-react';

const navItems = [
  { path: '/', label: '首页', icon: Home },
  { path: '/import', label: '标注导入', icon: FileUp },
  { path: '/workbench', label: '质检工作台', icon: ClipboardCheck },
  { path: "/conflicts", label: "冲突样本表", icon: AlertTriangle },
  { path: "/report", label: "复盘报告", icon: BarChart3 },
  { path: '/export', label: '数据导出', icon: Download },
  { path: '/rules', label: '边界规则', icon: BookOpen }
];

export function Layout() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center shadow-lg">
                <ClipboardCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">售后机器人转人工判断</h1>
                <p className="text-xs text-slate-500">质检复核系统</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-md'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </NavLink>
                );
              })}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white/50 mt-auto">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <p className="text-xs text-slate-400 text-center">
            售后机器人转人工判断系统 · 边界规则版本 1.0.0 · 数据持久化至本地
          </p>
        </div>
      </footer>
    </div>
  );
}
