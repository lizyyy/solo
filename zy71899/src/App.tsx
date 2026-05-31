import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { Sidebar } from '@/components/Sidebar';
import { SourcePanel } from '@/components/SourcePanel';
import { NotificationPanel } from '@/components/NotificationPanel';
import { Dashboard } from '@/pages/Dashboard';
import { PulseAnalysis } from '@/pages/PulseAnalysis';
import { ShiftRecords } from '@/pages/ShiftRecords';
import { WorkLogs } from '@/pages/WorkLogs';
import { MaintenanceOrders } from '@/pages/MaintenanceOrders';
import { HistoryPage } from '@/pages/History';
import { ExportPage } from '@/pages/Export';
import { initDB, initMockData } from '@/utils/db';
import { useUIStore } from '@/stores/uiStore';
import { useRecordsStore } from '@/stores/recordsStore';

function AppContent() {
  const location = useLocation();
  const { currentPath, setCurrentPath, sourcePanelOpen, showNotificationPanel } = useUIStore();

  useEffect(() => {
    setCurrentPath(location.pathname);
  }, [location.pathname, setCurrentPath]);

  return (
    <div className="flex h-screen overflow-hidden bg-industrial-bg">
      <Sidebar />

      <main className="flex-1 overflow-y-auto">
        <div className="p-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/pulse-analysis" element={<PulseAnalysis />} />
            <Route path="/records/shift" element={<ShiftRecords />} />
            <Route path="/records/logs" element={<WorkLogs />} />
            <Route path="/records/maintenance" element={<MaintenanceOrders />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/export" element={<ExportPage />} />
          </Routes>
        </div>
      </main>

      {sourcePanelOpen && <SourcePanel />}
      {showNotificationPanel && <NotificationPanel />}
    </div>
  );
}

export default function App() {
  const [dbReady, setDbReady] = useState(false);
  const { loadNotifications } = useRecordsStore();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const forceReset = urlParams.get('reset') === '1';

    initDB().then(() => {
      console.log('IndexedDB initialized');
      return initMockData(forceReset);
    }).then(() => {
      console.log('Mock data initialized');
      loadNotifications();
      setDbReady(true);
    }).catch((err) => {
      console.error('Failed to initialize IndexedDB:', err);
      setDbReady(true);
    });
  }, []);

  if (!dbReady) {
    return (
      <div className="flex items-center justify-center h-screen bg-industrial-bg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-tech-blue mx-auto mb-4" />
          <p className="text-industrial-text-muted">初始化数据...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <AppContent />
    </Router>
  );
}
