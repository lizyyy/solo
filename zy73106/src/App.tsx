import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import DashboardPage from '@/pages/DashboardPage';
import DrawingsListPage from '@/pages/DrawingsListPage';
import DrawingDetailPage from '@/pages/DrawingDetailPage';
import VersionComparePage from '@/pages/VersionComparePage';
import ChangeTracePage from '@/pages/ChangeTracePage';
import ExportCenterPage from '@/pages/ExportCenterPage';
import RunReviewPage from '@/pages/RunReviewPage';

export default function App() {
  return (
    <Router>
      <AppLayout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/drawings" element={<DrawingsListPage />} />
          <Route path="/drawings/:id" element={<DrawingDetailPage />} />
          <Route path="/drawings/:id/versions" element={<VersionComparePage />} />
          <Route path="/drawings/:id/trace" element={<ChangeTracePage />} />
          <Route path="/export" element={<ExportCenterPage />} />
          <Route path="/run-review" element={<RunReviewPage />} />
          <Route
            path="*"
            element={
              <div className="panel-bordered p-12 text-center">
                <div className="font-display text-5xl text-blueprint-red mb-4">404</div>
                <div className="font-mono text-steel-300">图纸未归档 · 请检查路径</div>
              </div>
            }
          />
        </Routes>
      </AppLayout>
    </Router>
  );
}
