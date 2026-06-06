import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileImage,
  Music,
  BarChart3,
  Clock,
  History,
  AlertTriangle,
  Settings,
  Box,
} from 'lucide-react';
import { useStore } from '../store/useStore';

const menuItems = [
  { path: '/', label: '仪表盘', icon: LayoutDashboard },
  { path: '/contracts', label: '合同页截图', icon: FileImage },
  { path: '/aliases', label: '曲目别名表', icon: Music },
  { path: '/statistics', label: '排练迟到统计', icon: BarChart3 },
  { path: '/statistics/3d', label: '3D 统计视图', icon: Box },
  { path: '/history', label: '历史变更', icon: History },
  { path: '/review', label: '异常复核', icon: AlertTriangle },
  { path: '/rules', label: '边界规则', icon: Settings },
];

export default function Sidebar() {
  const location = useLocation();
  const pendingReviewCount = useStore((state) => state.getPendingReviewCount());
  const currentUser = useStore((state) => state.currentUser);

  return (
    <aside className="w-64 bg-primary-700 min-h-screen flex flex-col shadow-xl">
      <div className="p-6 border-b border-primary-600">
        <h1 className="text-xl font-serif font-bold text-white flex items-center gap-2">
          <Clock className="w-6 h-6 text-accent-400" />
          <span>乐团排练统计</span>
        </h1>
        <p className="text-primary-200 text-sm mt-1">可追溯的业务系统</p>
      </div>

      <nav className="flex-1 py-4 px-3">
        <ul className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            const showBadge = item.path === '/review' && pendingReviewCount > 0;

            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200
                    ${isActive
                      ? 'bg-primary-600 text-white shadow-inner'
                      : 'text-primary-100 hover:bg-primary-600/50 hover:text-white'
                    }
                  `}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-accent-400' : ''}`} />
                  <span className="text-sm font-medium">{item.label}</span>
                  {showBadge && (
                    <span className="ml-auto bg-danger-500 text-white text-xs px-2 py-0.5 rounded-full">
                      {pendingReviewCount}
                    </span>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-primary-600">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-accent-500 flex items-center justify-center text-white font-medium">
            {currentUser.name.charAt(0)}
          </div>
          <div>
            <p className="text-white text-sm font-medium">{currentUser.name}</p>
            <p className="text-primary-300 text-xs">
              {currentUser.role === 'store_manager' && '琴行店长'}
              {currentUser.role === 'copyright' && '版权运营'}
              {currentUser.role === 'admin' && '系统管理员'}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
