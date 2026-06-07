import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ManifestList } from '@/pages/ManifestList';
import { ManifestDetail } from '@/pages/ManifestDetail';
import { SelfCheck } from '@/pages/SelfCheck';
import { Evaluation } from '@/pages/Evaluation';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<ManifestList />} />
        <Route path="/manifest/:id" element={<ManifestDetail />} />
        <Route path="/self-check" element={<SelfCheck />} />
        <Route path="/evaluation" element={<Evaluation />} />
      </Routes>
    </Router>
  );
}
