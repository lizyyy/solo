import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import WorkorderList from '@/pages/WorkorderList';
import WorkorderDetail from '@/pages/WorkorderDetail';
import ImportPlayback from '@/pages/ImportPlayback';
import ExceptionReview from '@/pages/ExceptionReview';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<WorkorderList />} />
          <Route path="/workorder/:id" element={<WorkorderDetail />} />
          <Route path="/import" element={<ImportPlayback />} />
          <Route path="/review" element={<ExceptionReview />} />
          <Route path="*" element={<WorkorderList />} />
        </Route>
      </Routes>
    </Router>
  );
}
