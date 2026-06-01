import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import ImportPage from '@/pages/ImportPage';
import CloudPage from '@/pages/CloudPage';
import SchemesPage from '@/pages/SchemesPage';
import ExportPage from '@/pages/ExportPage';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/import" replace />} />
          <Route path="import" element={<ImportPage />} />
          <Route path="cloud" element={<CloudPage />} />
          <Route path="schemes" element={<SchemesPage />} />
          <Route path="export" element={<ExportPage />} />
        </Route>
      </Routes>
    </Router>
  );
}
