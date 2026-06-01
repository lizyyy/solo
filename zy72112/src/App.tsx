import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ImportPage from '@/pages/ImportPage';
import TuningPage from '@/pages/TuningPage';
import RecordDetailPage from '@/pages/RecordDetailPage';
import ComparePage from '@/pages/ComparePage';
import ReportPage from '@/pages/ReportPage';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<ImportPage />} />
        <Route path="/tuning" element={<TuningPage />} />
        <Route path="/record/:id" element={<RecordDetailPage />} />
        <Route path="/compare/:batchId" element={<ComparePage />} />
        <Route path="/report/:batchId" element={<ReportPage />} />
      </Routes>
    </Router>
  );
}
