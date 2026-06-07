import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import ImportPage from '@/pages/Import';
import ConflictDetail from '@/pages/ConflictDetail';
import ReviewPage from '@/pages/Review';
import VisualizationPage from '@/pages/Visualization';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/conflict/:id" element={<ConflictDetail />} />
          <Route path="/review/:id" element={<ReviewPage />} />
          <Route path="/visualization" element={<VisualizationPage />} />
        </Route>
      </Routes>
    </Router>
  );
}
