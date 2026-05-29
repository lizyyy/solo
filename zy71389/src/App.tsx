import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import { HomePage } from './pages/HomePage';
import { FileManagementPage } from './pages/FileManagementPage';
import { CheckPage } from './pages/CheckPage';
import { ReportPage } from './pages/ReportPage';
import { DetailsPage } from './pages/DetailsPage';
import { ExportPage } from './pages/ExportPage';

export default function App() {
  return (
    <Router>
      <MainLayout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/files" element={<FileManagementPage />} />
          <Route path="/check" element={<CheckPage />} />
          <Route path="/report" element={<ReportPage />} />
          <Route path="/details" element={<DetailsPage />} />
          <Route path="/export" element={<ExportPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </MainLayout>
    </Router>
  );
}
