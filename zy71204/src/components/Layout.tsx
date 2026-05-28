import { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FileUp, 
  FileText, 
  AlertTriangle, 
  ClipboardList,
  Receipt
} from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

const navItems = [
  { path: '/dashboard', label: '数据看板', icon: LayoutDashboard },
  { path: '/import', label: '批量导入', icon: FileUp },
  { path: '/bills', label: '票据管理', icon: FileText },
  { path: '/exceptions', label: '异常中心', icon: AlertTriangle },
  { path: '/audit', label: '审计导出', icon: ClipboardList },
];

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="w-64 bg-white border-r border-slate-200 fixed h-full z-10">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-600 to-primary-800 rounded-xl flex items-center justify-center">
              <Receipt className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-slate-900">票据池管理</h1>
              <p className="text-xs text-slate-500">Bill Pool Manager</p>
            </div>
          </div>
        </div>
        
        <nav className="p-4 space-y-1">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`nav-link ${isActive ? 'active' : ''}`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
        
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-200">
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-500">当前操作员</p>
            <p className="font-medium text-sm text-slate-700">资金经理</p>
          </div>
        </div>
      </aside>
      
      <main className="ml-64 flex-1">
        <header className="bg-white border-b border-slate-200 px-8 py-4 sticky top-0 z-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">
              {navItems.find(n => n.path === location.pathname)?.label}
            </h2>
            <div className="flex items-center gap-4">
              <div className="text-sm text-slate-500">
                {new Date().toLocaleDateString('zh-CN', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  weekday: 'long'
                })}
              </div>
            </div>
          </div>
        </header>
        
        <div className="p-8 animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}
