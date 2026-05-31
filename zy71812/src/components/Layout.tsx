import { NavLink, Outlet } from 'react-router-dom';
import { useReviewStore } from '../store/useReviewStore';
import { ClipboardList, AlertTriangle, History, Download, RefreshCw } from 'lucide-react';

export function Layout() {
  const { currentOperator, getPendingCount, resetData } = useReviewStore();
  const pendingCount = getPendingCount();

  const navItems = [
    { path: '/', label: '复核工作台', icon: ClipboardList, badge: pendingCount },
    { path: '/anomalies', label: '异常中心', icon: AlertTriangle, badge: pendingCount },
    { path: '/audit', label: '状态回看', icon: History },
    { path: '/export', label: '导出中心', icon: Download },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-bg-primary">
      <header className="h-14 border-b border-bg-border bg-bg-secondary flex items-center justify-between px-6 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-status-normal/20 rounded flex items-center justify-center">
            <ClipboardList className="w-4 h-4 text-status-normal" />
          </div>
          <div>
            <h1 className="text-data-base font-semibold text-text-primary">供应商扣款复核</h1>
            <p className="text-data-xs text-text-muted">财务结算复核工作台</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-data-sm text-text-secondary">
            <span className="w-2 h-2 rounded-full bg-status-normal"></span>
            <span>操作员：{currentOperator}</span>
          </div>
          <button
            onClick={() => {
              if (confirm('确定要重置所有数据吗？此操作不可恢复。')) {
                resetData();
              }
            }}
            className="btn-secondary flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            重置数据
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <nav className="w-56 border-r border-bg-border bg-bg-secondary flex-shrink-0">
          <div className="p-3">
            <p className="text-data-xs text-text-muted px-3 py-2">功能导航</p>
            <div className="space-y-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3 py-2.5 rounded text-data-sm transition-colors ${
                      isActive
                        ? 'bg-bg-tertiary text-text-primary'
                        : 'text-text-secondary hover:bg-bg-tertiary/50 hover:text-text-primary'
                    }`
                  }
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="ml-auto px-1.5 py-0.5 bg-status-pending/20 text-status-pending text-data-xs rounded font-mono">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          </div>

          <div className="px-3 py-4 border-t border-bg-border mt-4">
            <p className="text-data-xs text-text-muted px-3 py-2">统计概览</p>
            <div className="space-y-2 px-3">
              <StatRow label="待确认" value={pendingCount} color="pending" />
              <StatRow
                label="已确认"
                value={useReviewStore.getState().refunds.filter((r) => r.status === 'normal').length}
                color="normal"
              />
            </div>
          </div>
        </nav>

        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function StatRow({ label, value, color }: { label: string; value: number; color: 'normal' | 'pending' | 'anomaly' }) {
  const colorClasses = {
    normal: 'text-status-normal',
    pending: 'text-status-pending',
    anomaly: 'text-status-anomaly',
  };

  return (
    <div className="flex items-center justify-between">
      <span className="text-data-sm text-text-secondary">{label}</span>
      <span className={`font-mono font-semibold ${colorClasses[color]}`}>{value}</span>
    </div>
  );
}
