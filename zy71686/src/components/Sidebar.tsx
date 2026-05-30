import { useAppStore } from '../store';
import {
  LayoutDashboard,
  ShieldAlert,
  Network,
  Upload,
  GitBranch,
  FileText,
  Settings,
  Shield,
} from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: '仪表盘', icon: LayoutDashboard },
  { id: 'riskList', label: '风险分析', icon: ShieldAlert },
  { id: 'graph', label: '担保圈图谱', icon: Network },
  { id: 'import', label: '数据导入', icon: Upload },
  { id: 'version', label: '版本管理', icon: GitBranch },
  { id: 'report', label: '报告导出', icon: FileText },
];

export function Sidebar() {
  const currentPage = useAppStore((state) => state.currentPage);
  const setCurrentPage = useAppStore((state) => state.setCurrentPage);
  const activeVersion = useAppStore((state) => state.activeVersion);

  return (
    <aside className="w-64 bg-white border-r border-gray-200 shadow-sidebar flex flex-col h-screen fixed left-0 top-0 z-40">
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-gray-900 text-lg">担保圈</h1>
            <p className="text-xs text-gray-500">授信风险暴露系统</p>
          </div>
        </div>
      </div>

      {activeVersion && (
        <div className="px-4 py-3 bg-primary-50 border-b border-primary-100">
          <p className="text-xs text-primary-600 font-medium">当前版本</p>
          <p className="text-sm text-primary-800 font-semibold truncate">{activeVersion.name}</p>
          <p className="text-xs text-primary-500 mt-0.5">v{activeVersion.dataVersion}</p>
        </div>
      )}

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-thin">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              className={`sidebar-link w-full ${isActive ? 'sidebar-link-active' : ''}`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-gray-100">
        <button className="sidebar-link w-full">
          <Settings className="w-5 h-5" />
          <span>系统设置</span>
        </button>
      </div>
    </aside>
  );
}
