import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { ImportPage } from '@/pages/ImportPage';
import { LabelsPage } from '@/pages/LabelsPage';
import { ReviewPage } from '@/pages/ReviewPage';
import { SelfCheckPage } from '@/pages/SelfCheckPage';
import { WeeklyReportPage } from '@/pages/WeeklyReportPage';
import { useEffect } from 'react';
import { useEmotionLabelStore } from '@/store/useEmotionLabelStore';

function AppContent() {
  const { loadSampleData, records, runSelfCheck, runConsistencyCheck, clearAllData } = useEmotionLabelStore();

  useEffect(() => {
    if (records.length === 0) {
      loadSampleData();
    } else {
      runSelfCheck();
    }
    runConsistencyCheck();
  }, []);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<ImportPage />} />
            <Route path="/labels" element={<LabelsPage />} />
            <Route path="/review" element={<ReviewPage />} />
            <Route path="/self-check" element={<SelfCheckPage />} />
            <Route path="/weekly-report" element={<WeeklyReportPage />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}
