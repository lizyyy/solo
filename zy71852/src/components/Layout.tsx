import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, AlertTriangle, FileDown, GitBranch } from 'lucide-react';

const navItems = [
  { path: '/experiments', label: '实验列表', icon: LayoutDashboard },
  { path: '/anomalies', label: '异常总览', icon: AlertTriangle },
  { path: '/history', label: '历史回溯', icon: GitBranch },
  { path: '/export', label: '导出中心', icon: FileDown },
];

export function Layout() {
  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="bg-primary border-b border-primary-dark">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-xl font-mono font-semibold text-white">
            桥梁受力拼装实验管理系统
          </h1>
          <p className="text-sm text-blue-200 mt-1">
            BRIDGE ASSEMBLY EXPERIMENT MANAGEMENT SYSTEM
          </p>
        </div>
      </header>

      <nav className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex space-x-8">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'border-primary text-primary'
                        : 'border-transparent text-neutral-600 hover:text-primary hover:border-neutral-300'
                    }`
                  }
                >
                  <Icon size={16} />
                  {item.label}
                </NavLink>
              );
            })}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
