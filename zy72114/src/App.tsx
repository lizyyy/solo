import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Workspace from '@/pages/Workspace';
import HistoryCompare from '@/pages/HistoryCompare';
import ReportPreview from '@/pages/ReportPreview';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Workspace />} />
        <Route path="/history" element={<HistoryCompare />} />
        <Route path="/report/:id" element={<ReportPreview />} />
      </Routes>
    </Router>
  );
}
