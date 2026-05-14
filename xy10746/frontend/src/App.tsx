import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import VersionListPage from './pages/VersionListPage';
import VersionDetail from './pages/VersionDetail';
import StatisticsPage from './pages/StatisticsPage';
import ExportPage from './pages/ExportPage';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/versions" element={<VersionListPage />} />
          <Route path="/versions/:versionId" element={<VersionDetail />} />
          <Route path="/statistics" element={<StatisticsPage />} />
          <Route path="/export" element={<ExportPage />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
