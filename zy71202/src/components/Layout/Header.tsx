import React from 'react';
import { RefreshCw, Bell, User, Settings } from 'lucide-react';
import { useAppStore } from '@/store';
import { formatDateTime } from '@/utils/format';
import clsx from 'clsx';

const Header: React.FC = () => {
  const { isRefreshing, lastRefreshTime, refreshAllData, disposalTasks, reminderLogs } = useAppStore();

  const pendingCount = disposalTasks.filter(t => t.status === 'PENDING_CONFIRM').length;
  const returnedCount = disposalTasks.filter(t => t.status === 'RETURNED').length;
  const notificationCount = pendingCount + returnedCount;

  const handleRefresh = () => {
    refreshAllData();
  };

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
      <div className="flex items-center justify-between h-16 px-6">
        <div>
          <h1 className="text-xl font-serif font-semibold text-slate-800">可转债强赎提醒系统</h1>
          {lastRefreshTime && (
            <p className="text-xs text-slate-500 mt-0.5">
              数据更新时间: {formatDateTime(lastRefreshTime)}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="btn-secondary gap-2"
          >
            <RefreshCw className={clsx('w-4 h-4', isRefreshing && 'animate-spin')} />
            <span>{isRefreshing ? '刷新中...' : '刷新数据'}</span>
          </button>

          <div className="relative">
            <button className="p-2 rounded-md hover:bg-slate-100 transition-colors relative">
              <Bell className="w-5 h-5 text-slate-600" />
              {notificationCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-danger-500 text-white text-xs font-medium rounded-full">
                  {notificationCount}
                </span>
              )}
            </button>
          </div>

          <button className="p-2 rounded-md hover:bg-slate-100 transition-colors">
            <Settings className="w-5 h-5 text-slate-600" />
          </button>

          <div className="h-8 w-px bg-slate-200" />

          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-700">张交易员</p>
              <p className="text-xs text-slate-500">固收投资部</p>
            </div>
            <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-primary-700 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
