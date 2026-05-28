import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Workbench from '@/pages/Workbench';
import DataManager from '@/pages/DataManager';
import ReportPreview from '@/pages/ReportPreview';
import { useMainStore } from '@/store/mainStore';

export default function App() {
  const { loadDemoData } = useMainStore();

  useEffect(() => {
    loadDemoData();
  }, [loadDemoData]);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Workbench />} />
        <Route path="/data" element={<DataManager />} />
        <Route path="/report" element={<ReportPreview />} />
      </Routes>
    </Router>
  );
}
