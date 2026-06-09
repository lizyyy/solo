import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import DashboardPage from '@/pages/DashboardPage';
import InspectionsPage from '@/pages/InspectionsPage';
import TimelinePage from '@/pages/TimelinePage';
import FormulaPage from '@/pages/FormulaPage';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/inspections" element={<InspectionsPage />} />
          <Route path="/inspections/:id" element={<InspectionsPage />} />
          <Route path="/timeline" element={<TimelinePage />} />
          <Route path="/formula" element={<FormulaPage />} />
          <Route path="*" element={<DashboardPage />} />
        </Route>
      </Routes>
    </Router>
  );
}
