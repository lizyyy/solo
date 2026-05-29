import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Sidebar from '@/components/Sidebar';
import RetrievalWorkspace from '@/pages/RetrievalWorkspace';
import RecordsCenter from '@/pages/RecordsCenter';
import AnalysisPanel from '@/pages/AnalysisPanel';
import ReportExport from '@/pages/ReportExport';

const App: React.FC = () => {
  return (
    <div className="h-screen flex bg-gradient-to-br from-slate-900 to-slate-800 overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Routes>
          <Route path="/" element={<RetrievalWorkspace />} />
          <Route path="/records" element={<RecordsCenter />} />
          <Route path="/analysis" element={<AnalysisPanel />} />
          <Route path="/report" element={<ReportExport />} />
        </Routes>
      </main>
    </div>
  );
};

export default App;
