import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileUp,
  BarChart3,
  SlidersHorizontal,
  FileCheck,
  UserCheck,
  ShieldAlert,
  Leaf,
} from 'lucide-react';
import { useClearingStore } from '@/store/useClearingStore';

const menuItems = [
  { path: '/', label: '小看板', icon: LayoutDashboard, badge: null },
  { path: '/import', label: '数据导入', icon: FileUp, badge: null },
  { path: '/overview', label: '清算总览', icon: BarChart3, badge: null },
  { path: '/adjustments', label: '尾差调整', icon: SlidersHorizontal, badge: 'pendingReview' },
  { path: '/custody', label: '托管确认', icon: FileCheck, badge: 'pendingCustody' },
  { path: '/summary', label: '负责人摘要', icon: UserCheck, badge: null },
  { path: '/review', label: '复核工作台', icon: ShieldAlert, badge: 'pendingReview' },
];

export default function Sidebar() {
  const location = useLocation();
  const { getOverviewStats, currentRole } = useClearingStore();
  const stats = getOverviewStats();

  const getBadgeCount = (badgeType: string | null) => {
    if (!badgeType) return 0;
    if (badgeType === 'pendingCustody') return stats.pendingCustody;
    if (badgeType === 'pendingReview') return stats.pendingReview;
    return 0;
  };

  return (
    <aside className="w-64 bg-carbon-800 text-white min-h-screen flex flex-col">
      <div className="p-6 border-b border-carbon-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-finance-green rounded-lg flex items-center justify-center">
            <Leaf className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg">碳配额清算</h1>
            <p className="text-xs text-carbon-400">Carbon Clearing System</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            const badgeCount = getBadgeCount(item.badge);

            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'bg-carbon-700 text-white shadow-lg'
                      : 'text-carbon-300 hover:bg-carbon-700/50 hover:text-white'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-finance-green' : ''}`} />
                  <span className="flex-1">{item.label}</span>
                  {badgeCount > 0 && (
                    <span className="px-2 py-0.5 bg-risk-red text-white text-xs rounded-full font-medium animate-pulse-slow">
                      {badgeCount}
                    </span>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-carbon-700">
        <div className="bg-carbon-700/50 rounded-lg p-4">
          <p className="text-xs text-carbon-400 mb-2">系统提示</p>
          <p className="text-sm text-carbon-300">
            {currentRole === 'risk'
              ? '风控同事您好，待复核的记录已标记红色，请优先处理。'
              : currentRole === 'executive'
              ? '负责人您好，摘要页面汇总了所有待确认事项。'
              : '小周您好，记得及时补录托管确认页哦～'}
          </p>
        </div>
      </div>
    </aside>
  );
}
