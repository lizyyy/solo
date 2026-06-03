import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from '@/components/Layout';
import Home from '@/pages/Home';
import ImportPage from '@/pages/ImportPage';
import CadPage from '@/pages/CadPage';
import ConflictsPage from '@/pages/ConflictsPage';
import CoordinatesPage from '@/pages/CoordinatesPage';
import SelfCheckPage from '@/pages/SelfCheckPage';
import HistoryPage from '@/pages/HistoryPage';
import InstructionsPage from '@/pages/InstructionsPage';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/cad" element={<CadPage />} />
          <Route path="/conflicts" element={<ConflictsPage />} />
          <Route path="/coordinates" element={<CoordinatesPage />} />
          <Route path="/self-check" element={<SelfCheckPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/instructions" element={<InstructionsPage />} />
        </Route>
      </Routes>
    </Router>
  );
}
