import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Upload,
  Sliders,
  Building2,
  FileBarChart,
  FolderKanban,
  User,
  Bell,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';

interface LayoutProps {
  children: ReactNode;
}

const navItems = [
  { path: '/', label: '数据导入', icon: Upload },
  { path: '/parameter', label: '参数配置', icon: Sliders },
  { path: '/scene', label: '场景明细', icon: Building2 },
  { path: '/report', label: '报告生成', icon: FileBarChart },
  { path: '/solutions', label: '方案管理', icon: FolderKanban },
];

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const currentSolution = useAppStore((state) => state.currentSolution);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="w-64 bg-primary-900 text-white flex flex-col shadow-xl">
        <div className="p-6 border-b border-primary-700">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Building2 className="w-6 h-6" />
            智慧园区能耗楼宇
          </h1>
          <p className="text-primary-300 text-sm mt-1">数据校验系统</p>
        </div>

        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                      isActive
                        ? 'bg-white/10 text-white shadow-inner'
                        : 'text-primary-200 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-primary-700">
          <div className="bg-primary-800 rounded-lg p-4">
            <p className="text-sm text-primary-300">当前方案</p>
            <p className="font-medium truncate">
              {currentSolution?.name || '未选择'}
            </p>
            <p className="text-xs text-primary-400 mt-1">
              设备数: {currentSolution?.devices.length || 0}
            </p>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col">
        <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">
                {navItems.find((item) => item.path === location.pathname)?.label}
              </h2>
              <p className="text-sm text-gray-500">
                {new Date().toLocaleDateString('zh-CN', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  weekday: 'long',
                })}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <button className="p-2 rounded-lg hover:bg-gray-100 relative">
                <Bell className="w-5 h-5 text-gray-600" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-accent-red rounded-full"></span>
              </button>
              <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
                <div className="w-9 h-9 bg-primary-100 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">林老师</p>
                  <p className="text-xs text-gray-500">教学老师</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
