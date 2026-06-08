import { Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import DashboardPage from '@/pages/DashboardPage';
import HandoverPage from '@/pages/HandoverPage';
import ReceptionPage from '@/pages/ReceptionPage';

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/handover" element={<HandoverPage />} />
        <Route path="/reception" element={<ReceptionPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
