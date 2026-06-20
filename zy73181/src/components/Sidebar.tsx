import { Link, useLocation } from 'react-router-dom';
import { ListOrdered, SquareSigma, FileSpreadsheet, AlertTriangle, LayoutDashboard } from 'lucide-react';

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { path: '/', label: '题目清单', icon: ListOrdered },
  { path: '/review', label: '边界复核', icon: SquareSigma },
  { path: '/demo', label: '演示数据', icon: AlertTriangle },
  { path: '/export', label: '导出报告', icon: FileSpreadsheet },
];

export default function Sidebar() {
  const location = useLocation();

  return (
    <aside className="w-60 bg-academic-800 text-white flex flex-col min-h-screen">
      <div className="p-6 border-b border-academic-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-gold-glow">
            <LayoutDashboard className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-display text-lg font-bold leading-tight text-amber-300">
              约束规划
            </h1>
            <p className="text-[11px] text-academic-300 tracking-wide">边界复核系统</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 py-4">
        <div className="px-3 mb-2">
          <p className="text-[11px] font-medium text-academic-400 uppercase tracking-wider px-3">
            工作区
          </p>
        </div>
        <ul className="space-y-1 px-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-academic-600 text-white shadow-inner'
                      : 'text-academic-200 hover:bg-academic-700 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-academic-700">
        <div className="bg-academic-700/50 rounded-lg p-3">
          <p className="text-[11px] text-academic-400 mb-1">数学教研组 · 老叶</p>
          <p className="text-xs text-amber-300 font-medium">v2.1 灰度发布中</p>
        </div>
      </div>
    </aside>
  );
}
