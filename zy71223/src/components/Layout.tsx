import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Receipt, Calculator, FileBarChart, AlertTriangle, Home } from 'lucide-react';

const navItems = [
  { path: '/', icon: Home, label: '工作台' },
  { path: '/vouchers', icon: Receipt, label: '凭证管理' },
  { path: '/balance', icon: Calculator, label: '余额校验' },
  { path: '/reports', icon: FileBarChart, label: '报告导出' },
];

const statusLabels: Record<string, { label: string; class: string }> = {
  pending: { label: '待处理', class: 'bg-yellow-100 text-yellow-800' },
  parsing: { label: '解析中', class: 'bg-blue-100 text-blue-800' },
  reviewing: { label: '待审核', class: 'bg-purple-100 text-purple-800' },
  revised: { label: '已修订', class: 'bg-orange-100 text-orange-800' },
  completed: { label: '已完成', class: 'bg-green-100 text-green-800' },
  exception: { label: '异常', class: 'bg-red-100 text-red-800' },
};

export function formatStatus(status: string) {
  return statusLabels[status] || { label: status, class: 'bg-gray-100 text-gray-800' };
}

export function formatMoney(amount: number) {
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(amount);
}

export function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('zh-CN');
}

export function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('zh-CN');
}

export default function Layout() {
  const location = useLocation();

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-60 bg-slate-900 text-white flex flex-col">
        <div className="p-5 border-b border-slate-700">
          <h1 className="text-lg font-bold tracking-wide font-display">代理记账现金凭证</h1>
          <p className="text-slate-400 text-xs mt-1">全链路追溯 · 智能风控</p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-primary-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-700">
          <div className="text-sm text-slate-400">操作员：张会计</div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 bg-white border-b border-gray-200 flex items-center px-6 justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>当前位置</span>
            <span>/</span>
            <span className="text-gray-900 font-medium">
              {navItems.find(n => location.pathname.startsWith(n.path))?.label || '工作台'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 text-red-700 text-xs">
              <AlertTriangle size={12} />
              2 张票据待补资料
            </span>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
