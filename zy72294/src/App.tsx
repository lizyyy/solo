import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import ImportPage from '@/pages/ImportPage';
import EstimationPage from '@/pages/EstimationPage';
import ObstaclesPage from '@/pages/ObstaclesPage';
import ReviewPage from '@/pages/ReviewPage';
import VisualizationPage from '@/pages/VisualizationPage';
import ReportPage from '@/pages/ReportPage';
import HistoryPage from '@/pages/HistoryPage';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/estimation" element={<EstimationPage />} />
          <Route path="/obstacles" element={<ObstaclesPage />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/visualization" element={<VisualizationPage />} />
          <Route path="/report" element={<ReportPage />} />
          <Route path="/history" element={<HistoryPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
