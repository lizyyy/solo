import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import TerrainPage from '@/pages/TerrainPage';
import DataPage from '@/pages/DataPage';
import AnomalyPage from '@/pages/AnomalyPage';
import ExportPage from '@/pages/ExportPage';
import AuditPage from '@/pages/AuditPage';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/terrain" replace />} />
        <Route path="/terrain" element={<TerrainPage />} />
        <Route path="/data" element={<DataPage />} />
        <Route path="/anomaly" element={<AnomalyPage />} />
        <Route path="/export" element={<ExportPage />} />
        <Route path="/audit" element={<AuditPage />} />
        <Route path="*" element={<Navigate to="/terrain" replace />} />
      </Routes>
    </Router>
  );
}
