import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useAppStore } from '@/store';
import Sidebar from '@/components/Sidebar';
import TransitionMatrixPage from '@/pages/TransitionMatrixPage';
import ForecastPage from '@/pages/ForecastPage';
import PromoAnalysisPage from '@/pages/PromoAnalysisPage';
import AnomalyPage from '@/pages/AnomalyPage';
import ReportsPage from '@/pages/ReportsPage';

function AppLayout() {
  const { initializeData, isLoading } = useAppStore();

  useEffect(() => {
    initializeData();
  }, [initializeData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-navy-50 to-white">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">📊</div>
          <h2 className="font-display text-2xl font-bold text-navy-900 mb-2">
            库存周转马尔可夫链分析系统
          </h2>
          <p className="text-navy-500">正在初始化数据...</p>
          <div className="mt-4 w-64 h-2 bg-navy-100 rounded-full overflow-hidden">
            <div className="h-full bg-navy-600 rounded-full animate-pulse" style={{ width: '60%' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-navy-50 to-white">
      <Sidebar />
      <main className="flex-1 min-h-screen p-8 overflow-x-hidden">
        <div className="max-w-7xl mx-auto">
          <Routes>
            <Route path="/" element={<TransitionMatrixPage />} />
            <Route path="/forecast" element={<ForecastPage />} />
            <Route path="/promo" element={<PromoAnalysisPage />} />
            <Route path="/anomaly" element={<AnomalyPage />} />
            <Route path="/reports" element={<ReportsPage />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppLayout />
    </Router>
  );
}
