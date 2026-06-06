import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Dashboard } from '@/pages/Dashboard';
import { Thresholds } from '@/pages/Thresholds';
import { Equipment } from '@/pages/Equipment';
import { Tracking } from '@/pages/Tracking';
import { Playback } from '@/pages/Playback';
import { Review } from '@/pages/Review';
import { Reports } from '@/pages/Reports';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route element={<MainLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/thresholds" element={<Thresholds />} />
          <Route path="/equipment" element={<Equipment />} />
          <Route path="/tracking" element={<Tracking />} />
          <Route path="/playback" element={<Playback />} />
          <Route path="/review" element={<Review />} />
          <Route path="/reports" element={<Reports />} />
        </Route>
      </Routes>
    </Router>
  );
}
