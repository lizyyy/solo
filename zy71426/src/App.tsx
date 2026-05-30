import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from '@/pages/Home';
import Cases from '@/pages/Cases';
import CaseDetail from '@/pages/CaseDetail';
import Result from '@/pages/Result';
import Report from '@/pages/Report';
import History from '@/pages/History';
import Rules from '@/pages/Rules';
import { useGameStore } from '@/store/gameStore';

export default function App() {
  const { loadCases } = useGameStore();

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/rules" element={<Rules />} />
        <Route path="/cases" element={<Cases />} />
        <Route path="/history" element={<History />} />
        <Route path="/case/:id" element={<CaseDetail />} />
        <Route path="/result/:id" element={<Result />} />
        <Route path="/report/:id" element={<Report />} />
      </Routes>
    </Router>
  );
}
