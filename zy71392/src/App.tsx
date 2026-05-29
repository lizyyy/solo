import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import ImportPage from '@/pages/ImportPage';
import ScriptList from '@/pages/ScriptList';
import ScriptDetail from '@/pages/ScriptDetail';
import PermissionPage from '@/pages/PermissionPage';
import ExceptionPage from '@/pages/ExceptionPage';
import RiskPage from '@/pages/RiskPage';
import ReportPage from '@/pages/ReportPage';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/scripts" element={<ScriptList />} />
          <Route path="/scripts/:id" element={<ScriptDetail />} />
          <Route path="/permissions/:id" element={<PermissionPage />} />
          <Route path="/exceptions" element={<ExceptionPage />} />
          <Route path="/risks" element={<RiskPage />} />
          <Route path="/reports" element={<ReportPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Router>
  );
}
