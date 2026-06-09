import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Home } from '@/pages/Home';
import { Checklist } from '@/pages/Checklist';
import { Sample } from '@/pages/Sample';
import { History } from '@/pages/History';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/checklist/:batchId" element={<Checklist />} />
        <Route path="/sample" element={<Sample />} />
        <Route path="/history" element={<History />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
