import React, { useEffect } from 'react';
import { Routes, Route, BrowserRouter } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { DependencyPage } from './pages/DependencyPage';
import { ReviewPage } from './pages/ReviewPage';
import { WaiverPage } from './pages/WaiverPage';
import { ReportPage } from './pages/ReportPage';
import { ConfigPage } from './pages/ConfigPage';
import { seedLicenseDefinitions } from './db';
import { seedDemoData } from './mock/demoData';

function App() {
  useEffect(() => {
    seedLicenseDefinitions();
    seedDemoData();
  }, []);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50 flex">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<DependencyPage />} />
            <Route path="/review" element={<ReviewPage />} />
            <Route path="/waiver" element={<WaiverPage />} />
            <Route path="/report" element={<ReportPage />} />
            <Route path="/config" element={<ConfigPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
