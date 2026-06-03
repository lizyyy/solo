import { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ChevronRight, User, ChevronDown } from 'lucide-react';
import { useClearingStore } from '@/store/useClearingStore';
import type { UserRole } from '@shared/types';

const userOptions: { name: string; role: UserRole; avatar: string }[] = [
  { name: '小周', role: 'assistant', avatar: '周' },
  { name: '李工', role: 'risk', avatar: '李' },
  { name: '负责人', role: 'executive', avatar: '负' },
];

const breadcrumbLabels: Record<string, string> = {
  '/': '小看板',
  '/import': '数据导入',
  '/overview': '清算总览',
  '/adjustments': '尾差调整',
  '/custody': '托管确认',
  '/summary': '负责人摘要',
  '/review': '复核工作台',
};

export default function Header() {
  const location = useLocation();
  const { currentUser, currentRole, setCurrentUser } = useClearingStore();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const getBreadcrumbs = () => {
    const path = location.pathname;
    const crumbs: { label: string; path: string }[] = [{ label: '首页', path: '/' }];

    if (path !== '/') {
      const basePath = '/' + path.split('/')[1];
      if (breadcrumbLabels[basePath]) {
        crumbs.push({ label: breadcrumbLabels[basePath], path: basePath });
      }

      const id = path.split('/')[2];
      if (id) {
        crumbs.push({ label: `#${id.slice(-3)}`, path });
      }
    }

    return crumbs;
  };

  const breadcrumbs = getBreadcrumbs();
  const currentUserInfo = userOptions.find((u) => u.name === currentUser) || userOptions[0];

  return (
    <header className="bg-white border-b border-carbon-100 h-16 flex items-center justify-between px-6 sticky top-0 z-50">
      <div className="flex items-center gap-2 text-sm">
        {breadcrumbs.map((crumb, index) => (
          <div key={crumb.path} className="flex items-center gap-2">
            {index > 0 && <ChevronRight className="w-4 h-4 text-carbon-300" />}
            {index === breadcrumbs.length - 1 ? (
              <span className="text-carbon-800 font-medium">{crumb.label}</span>
            ) : (
              <Link
                to={crumb.path}
                className="text-carbon-500 hover:text-carbon-800 transition-colors"
              >
                {crumb.label}
              </Link>
            )}
          </div>
        ))}
      </div>

      <div className="relative">
        <button
          onClick={() => setShowUserMenu(!showUserMenu)}
          className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-carbon-50 transition-colors"
        >
          <div className="w-8 h-8 bg-carbon-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
            {currentUserInfo.avatar}
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-carbon-800">{currentUserInfo.name}</p>
            <p className="text-xs text-carbon-400">
              {currentUserInfo.role === 'assistant'
                ? '投研助理'
                : currentUserInfo.role === 'risk'
                ? '风控'
                : '负责人'}
            </p>
          </div>
          <ChevronDown className={`w-4 h-4 text-carbon-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
        </button>

        {showUserMenu && (
          <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-carbon-100 py-2 animate-fade-in">
            <div className="px-4 py-2 border-b border-carbon-100">
              <p className="text-xs text-carbon-400">切换身份</p>
            </div>
            {userOptions.map((user) => (
              <button
                key={user.name}
                onClick={() => {
                  setCurrentUser(user.name, user.role);
                  setShowUserMenu(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-2 hover:bg-carbon-50 transition-colors ${
                  currentUser === user.name ? 'bg-carbon-50' : ''
                }`}
              >
                <div className="w-6 h-6 bg-carbon-600 text-white rounded-full flex items-center justify-center text-xs font-medium">
                  {user.avatar}
                </div>
                <div className="text-left">
                  <p className="text-sm text-carbon-800">{user.name}</p>
                  <p className="text-xs text-carbon-400">
                    {user.role === 'assistant'
                      ? '投研助理'
                      : user.role === 'risk'
                      ? '风控'
                      : '负责人'}
                  </p>
                </div>
                {currentUser === user.name && (
                  <div className="ml-auto w-2 h-2 bg-finance-green rounded-full" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
