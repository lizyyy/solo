import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Database, Layers, FileText, Save } from 'lucide-react';

const navItems = [
  { path: '/import', label: '数据导入', icon: Database },
  { path: '/cloud', label: '3D 云台', icon: Layers },
  { path: '/schemes', label: '方案管理', icon: Save },
  { path: '/export', label: '报告导出', icon: FileText },
];

export default function Layout() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0f1320] text-slate-200 flex flex-col">
      <header className="h-14 border-b border-slate-700/50 bg-[#1a1f36] px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
            Σ
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-wide text-white">期权希腊值云台</h1>
            <p className="text-[10px] text-slate-400">给阿乔的交接工具 · 带原因的截图不翻车</p>
          </div>
        </div>
        <nav className="flex items-center gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => navigate(item.path)}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md text-xs flex items-center gap-1.5 transition-all ${
                  isActive
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/30'
                }`
              }
            >
              <item.icon size={14} />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
