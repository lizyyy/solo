import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Home } from '@/pages/Home';
import { UploadPage } from '@/pages/UploadPage';
import { ProcessPage } from '@/pages/ProcessPage';
import { HistoryPage } from '@/pages/HistoryPage';
import { ReportPage } from '@/pages/ReportPage';
import { NotFound } from '@/pages/NotFound';

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route
          path="/project/:id/*"
          element={<Layout />}
        >
          <Route path="upload" element={<UploadPage />} />
          <Route path="process" element={<ProcessPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="report" element={<ReportPage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
};

export default App;
