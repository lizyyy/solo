import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HallOverview from '@/pages/HallOverview';
import ReportPage from '@/pages/ReportPage';
import ComparePage from '@/pages/ComparePage';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HallOverview />} />
        <Route path="/report" element={<ReportPage />} />
        <Route path="/compare" element={<ComparePage />} />
      </Routes>
    </Router>
  );
}
