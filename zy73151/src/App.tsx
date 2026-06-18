import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import Dashboard from '@/pages/Dashboard';
import ImportPage from '@/pages/ImportPage';
import AnomaliesPage from '@/pages/AnomaliesPage';
import ComparePage from '@/pages/ComparePage';
import ReviewPage from '@/pages/ReviewPage';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/anomalies" element={<AnomaliesPage />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="/review" element={<ReviewPage />} />
        </Route>
      </Routes>
    </Router>
  );
}
