import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Sidebar } from '@/components/Layout/Sidebar';
import { Dashboard } from '@/pages/Dashboard';
import { ExperimentDetail } from '@/pages/ExperimentDetail';
import { SummaryPage } from '@/pages/Summary';
import { ConflictsPage } from '@/pages/Conflicts';
import { SelfCheckPage } from '@/pages/SelfCheck';
import { HistoryPage } from '@/pages/History';
import { useExperimentStore } from '@/store/useExperimentStore';

export default function App() {
  const { initMockData, initialized } = useExperimentStore();

  useEffect(() => {
    if (!initialized) {
      initMockData();
    }
  }, [initialized, initMockData]);

  if (!initialized) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-100">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/experiment/:id" element={<ExperimentDetail />} />
            <Route path="/summary" element={<SummaryPage />} />
            <Route path="/conflicts" element={<ConflictsPage />} />
            <Route path="/self-check" element={<SelfCheckPage />} />
            <Route path="/history" element={<HistoryPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
