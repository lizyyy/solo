import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import Workbench from './pages/Workbench';
import Compare from './pages/Compare';
import Review from './pages/Review';
import Handover from './pages/Handover';
import { useEffect } from 'react';

function AppContent() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen bg-ocean-950 grid-bg">
      <div className="radar-glow fixed inset-0 pointer-events-none" />
      <Sidebar />
      <main className="flex-1 relative">
        <Routes>
          <Route path="/" element={<Workbench />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/review" element={<Review />} />
          <Route path="/handover" element={<Handover />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}
