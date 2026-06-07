import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import ImportPage from '@/pages/ImportPage';
import WorkspacePage from '@/pages/WorkspacePage';
import HistoryPage from '@/pages/HistoryPage';
import SummaryPage from '@/pages/SummaryPage';
import { StepNavigator } from '@/components/StepNavigator';
import { useRecordsStore } from '@/store/useRecordsStore';
import { useEffect } from 'react';

function Layout() {
  const location = useLocation();
  const { setCurrentStep } = useRecordsStore();

  useEffect(() => {
    if (location.pathname === '/import' || location.pathname === '/') {
      setCurrentStep('import' as any);
    } else if (location.pathname === '/workspace') {
      setCurrentStep('bus_check' as any);
    } else if (location.pathname === '/summary') {
      setCurrentStep('summary' as any);
    }
  }, [location.pathname, setCurrentStep]);

  const showNavigator = !location.pathname.startsWith('/history/');

  return (
    <div className="min-h-screen bg-slate-100">
      {showNavigator && <StepNavigator />}
      <Routes>
        <Route path="/" element={<Navigate to="/import" replace />} />
        <Route path="/import" element={<ImportPage />} />
        <Route path="/workspace" element={<WorkspacePage />} />
        <Route path="/history/:recordId" element={<HistoryPage />} />
        <Route path="/summary" element={<SummaryPage />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Layout />
    </Router>
  );
}
