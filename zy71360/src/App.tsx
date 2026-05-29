import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { ShotListPage } from '@/pages/ShotListPage';
import { ShotDetailPage } from '@/pages/ShotDetailPage';
import { ShotEditPage } from '@/pages/ShotEditPage';
import { VersionHistoryPage } from '@/pages/VersionHistoryPage';
import { ExportPage } from '@/pages/ExportPage';

export default function App() {
  return (
    <Router>
      <AppLayout>
        <Routes>
          <Route path="/" element={<ShotListPage />} />
          <Route path="/shot/:id" element={<ShotDetailPage />} />
          <Route path="/shot/:id/edit" element={<ShotEditPage />} />
          <Route path="/shot/:id/history" element={<VersionHistoryPage />} />
          <Route path="/export" element={<ExportPage />} />
        </Routes>
      </AppLayout>
    </Router>
  );
}
