import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import Dashboard from '@/pages/Dashboard';
import PointsList from '@/pages/Points';
import PointsMerge from '@/pages/Points/Merge';
import FeedbacksList from '@/pages/Feedbacks';
import PlansList from '@/pages/Plans';
import PlanDetail from '@/pages/Plans/Detail';
import ReportsPage from '@/pages/Reports';
import ReportPreview from '@/pages/Reports/Preview';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="points" element={<PointsList />} />
          <Route path="points/merge" element={<PointsMerge />} />
          <Route path="feedbacks" element={<FeedbacksList />} />
          <Route path="plans" element={<PlansList />} />
          <Route path="plans/:id" element={<PlanDetail />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="reports/preview" element={<ReportPreview />} />
        </Route>
      </Routes>
    </Router>
  );
}
