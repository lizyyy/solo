import {
  LayoutDashboard,
  FileUp,
  Calculator,
  BarChart3,
  History,
  FileText,
} from 'lucide-react';
import type { PageType } from '@/types';

interface SidebarProps {
  currentPage: PageType;
  onPageChange: (page: PageType) => void;
}

const menuItems: { id: PageType; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: '仪表盘', icon: <LayoutDashboard size={20} /> },
  { id: 'import', label: '数据导入', icon: <FileUp size={20} /> },
  { id: 'workspace', label: '计算工作台', icon: <Calculator size={20} /> },
  { id: 'results', label: '结果分析', icon: <BarChart3 size={20} /> },
  { id: 'history', label: '历史记录', icon: <History size={20} /> },
  { id: 'report', label: '报告导出', icon: <FileText size={20} /> },
];

export function Sidebar({ currentPage, onPageChange }: SidebarProps) {
  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 min-h-screen flex flex-col">
      <div className="p-6 border-b border-slate-800">
        <h1 className="text-xl font-mono font-bold text-primary-400">
          地震波定位
        </h1>
        <p className="text-xs text-slate-500 mt-1">Seismic Location Tool</p>
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {menuItems.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => onPageChange(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                  currentPage === item.id
                    ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/30'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {item.icon}
                <span className="font-medium">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className="text-xs text-slate-500">
          <p>版本 v1.0.0</p>
          <p className="mt-1">© 2024 地震监测系统</p>
        </div>
      </div>
    </aside>
  );
}
