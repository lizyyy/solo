import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Calculator, History, Clock, FileText, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import WorkbenchPage from '@/pages/WorkbenchPage';
import HistoryPage from '@/pages/HistoryPage';
import PendingQueuePage from '@/pages/PendingQueuePage';
import ReportsPage from '@/pages/ReportsPage';
import ReportDetailPage from '@/pages/ReportDetailPage';
import { useProgressRecovery } from '@/hooks/useProgressRecovery';
import { initializeDemoData } from '@/utils/demoData';

const navItems = [
  { path: '/', label: '复核工作台', icon: Calculator },
  { path: '/history', label: '历史记录库', icon: History },
  { path: '/pending', label: '挂起队列', icon: AlertTriangle, badge: true },
  { path: '/reports', label: '报告中心', icon: FileText },
];

const Navbar: React.FC<{ pendingCount: number }> = ({ pendingCount }) => {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#1a202c] border-t border-[#4a5568]">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex justify-around py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || 
              (item.path !== '/' && location.pathname.startsWith(item.path));
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'relative flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors',
                  isActive
                    ? 'text-[#63b3ed] bg-[#1a365d]/30'
                    : 'text-[#718096] hover:text-[#a0aec0] hover:bg-[#2d3748]'
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-mono">{item.label}</span>
                {item.badge && pendingCount > 0 && (
                  <span className="absolute top-1 right-2 w-4 h-4 bg-[#dd6b20] text-white text-xs font-mono rounded-full flex items-center justify-center">
                    {pendingCount > 9 ? '9+' : pendingCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

const AppContent: React.FC = () => {
  const { showRecoveryDialog, recoverableSessions, recoverSession, dismissRecovery, pendingCount } = useProgressRecovery();

  useEffect(() => {
    window.onerror = (msg, src, lineno, colno, err) => {
      console.error('[Global Error]', msg, src, lineno, colno, err?.stack);
    };
    window.addEventListener('unhandledrejection', (event) => {
      console.error('[Unhandled Promise Rejection]', event.reason?.stack || event.reason);
    });

    console.log('[App] useEffect running, about to init demo data');
    initializeDemoData(false).then(() => {
      console.log('[App] Demo data initialization completed');
      localStorage.setItem('epc_demo_initialized', 'true');
    }).catch((err) => {
      console.error('[App] Demo data init error:', err?.stack || err);
    });
  }, []);

  return (
    <div className="min-h-screen bg-[#0d1117] pb-20">
      <Routes>
        <Route path="/" element={<WorkbenchPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/pending" element={<PendingQueuePage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/reports/:reportId" element={<ReportDetailPage />} />
      </Routes>

      <Navbar pendingCount={pendingCount} />

      {showRecoveryDialog && recoverableSessions.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6">
          <div className="w-full max-w-lg bg-[#1a202c] border border-[#4a5568] rounded-lg overflow-hidden">
            <div className="p-6 border-b border-[#4a5568]">
              <div className="flex items-center gap-3 mb-2">
                <Clock className="w-6 h-6 text-[#63b3ed]" />
                <h2 className="font-mono text-lg text-[#e2e8f0]">检测到未完成会话</h2>
              </div>
              <p className="text-sm text-[#a0aec0]">
                服务重启后检测到 {recoverableSessions.length} 个未完成的复核任务，是否恢复进度？
              </p>
            </div>

            <div className="p-6 space-y-3 max-h-64 overflow-auto">
              {recoverableSessions.map((storedSession) => (
                <button
                  key={storedSession.session.id}
                  onClick={() => recoverSession(storedSession.session.id)}
                  className="w-full p-4 bg-[#0d1117] border border-[#4a5568] rounded-lg hover:border-[#3182ce] transition-colors text-left"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-sm text-[#e2e8f0]">
                      #{storedSession.session.id.slice(0, 8)}
                    </span>
                    <span className="text-xs px-2 py-0.5 bg-[#1a365d] text-[#63b3ed] rounded">
                      {storedSession.session.progress?.completionPercentage?.toFixed(0) ?? '0'}%
                    </span>
                  </div>
                  <div className="text-xs text-[#718096]">
                    更新于 {new Date(storedSession.session.updatedAt).toLocaleString('zh-CN')}
                  </div>
                  <div className="mt-2 h-1.5 bg-[#2d3748] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#3182ce]"
                      style={{ width: `${storedSession.session.progress?.completionPercentage ?? 0}%` }}
                    />
                  </div>
                </button>
              ))}
            </div>

            <div className="p-4 border-t border-[#4a5568] flex justify-end gap-2">
              <button
                onClick={dismissRecovery}
                className="px-4 py-2 text-sm font-mono text-[#a0aec0] bg-transparent hover:bg-[#2d3748] rounded transition-colors"
              >
                暂不恢复
              </button>
              {recoverableSessions.length > 0 && (
                <button
                  onClick={() => recoverSession(recoverableSessions[0].session.id)}
                  className="px-4 py-2 text-sm font-mono text-white bg-[#3182ce] hover:bg-[#2c5282] rounded transition-colors"
                >
                  恢复最新
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <AppContent />
    </Router>
  );
};

export default App;
