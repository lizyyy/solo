import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import ImportPage from './pages/ImportPage';
import BillsPage from './pages/BillsPage';
import ExceptionsPage from './pages/ExceptionsPage';
import AuditPage from './pages/AuditPage';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/import" element={<ImportPage />} />
        <Route path="/bills" element={<BillsPage />} />
        <Route path="/exceptions" element={<ExceptionsPage />} />
        <Route path="/audit" element={<AuditPage />} />
      </Routes>
    </Layout>
  );
}

export default App;
