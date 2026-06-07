import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { 
  FileText, 
  Upload, 
  AlertTriangle, 
  CheckSquare, 
  Download,
  ClipboardList
} from 'lucide-react';

const navItems = [
  { path: '/', label: '记录总览', icon: FileText },
  { path: '/import', label: '数据导入', icon: Upload },
  { path: '/conflicts', label: '冲突复核', icon: AlertTriangle },
  { path: '/self-check', label: '自检中心', icon: CheckSquare },
  { path: '/export', label: '导出页面', icon: Download },
];

export const Layout: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="w-60 bg-white border-r border-slate-200 flex flex-col">
        <div className="h-16 flex items-center px-5 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-blue-700" />
            <h1 className="font-bold text-base text-slate-800">施工围挡绕行告示</h1>
          </div>
        </div>
        
        <nav className="flex-1 py-4 px-3">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`
                  }
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="p-4 border-t border-slate-200">
          <div className="text-xs text-slate-500">
            <p>当前操作员：社区书记周姐</p>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-6">
          <h2 className="text-lg font-semibold text-slate-800">
            施工围挡绕行告示管理系统
          </h2>
        </header>
        
        <div className="flex-1 p-6 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
