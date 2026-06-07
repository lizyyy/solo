import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from '@/components/Layout';
import Workbench from '@/pages/Workbench';
import ConflictsPage from '@/pages/ConflictsPage';
import SelfCheckPage from '@/pages/SelfCheckPage';
import HistoryPage from '@/pages/HistoryPage';
import NameReviewPage from '@/pages/NameReviewPage';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Workbench />} />
          <Route path="/conflicts" element={<ConflictsPage />} />
          <Route path="/self-check" element={<SelfCheckPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/name-review" element={<NameReviewPage />} />
        </Route>
      </Routes>
    </Router>
  );
}
