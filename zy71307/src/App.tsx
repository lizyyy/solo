import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Sidebar } from '@/components/Sidebar';
import { Dashboard } from '@/pages/Dashboard';
import { ExperimentList } from '@/pages/ExperimentList';
import { DataEntry } from '@/pages/DataEntry';
import { ThrustFitting } from '@/pages/ThrustFitting';
import { EfficiencyAnalysis } from '@/pages/EfficiencyAnalysis';
import { AnomalyDetection } from '@/pages/AnomalyDetection';
import { ReportExport } from '@/pages/ReportExport';
import { Settings } from '@/pages/Settings';
import { useExperimentStore } from '@/store/useExperimentStore';

function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const location = useLocation();
  const { loadExperiments, setCurrentExperiment } = useExperimentStore();

  useEffect(() => {
    loadExperiments();
  }, [loadExperiments]);

  useEffect(() => {
    const match = location.pathname.match(/\/experiments\/([^/]+)/);
    if (match) {
      setCurrentExperiment(match[1]);
    } else if (location.pathname === '/experiments') {
      setCurrentExperiment(null);
    }
  }, [location.pathname, setCurrentExperiment]);

  return (
    <div className="flex h-screen bg-industrial-950 overflow-hidden">
      <Sidebar collapsed={sidebarCollapsed} />

      <div className="flex-1 flex flex-col overflow-hidden relative">
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-industrial-800 border border-industrial-700 border-l-0 rounded-r-lg p-1.5 text-gray-400 hover:text-gray-200 hover:bg-industrial-700 transition-all"
          style={{ left: sidebarCollapsed ? '64px' : '256px' }}
        >
          {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>

        <main className="flex-1 overflow-hidden">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/experiments" element={<ExperimentList />} />
            <Route path="/experiments/:id/data" element={<DataEntry />} />
            <Route path="/experiments/:id/fitting" element={<ThrustFitting />} />
            <Route path="/experiments/:id/efficiency" element={<EfficiencyAnalysis />} />
            <Route path="/experiments/:id/anomalies" element={<AnomalyDetection />} />
            <Route path="/experiments/:id/report" element={<ReportExport />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <p className="text-4xl font-bold font-mono text-gray-600 mb-2">404</p>
                  <p className="text-gray-400">页面不存在</p>
                </div>
              </div>
            } />
          </Routes>
        </main>
      </div>
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
