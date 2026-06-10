import { useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import Home from '@/pages/Home';
import TrackerPage from '@/pages/TrackerPage';
import CollisionPage from '@/pages/CollisionPage';
import HistoryPage from '@/pages/HistoryPage';
import { useTrackStore } from '@/stores/trackStore';

export default function App() {
  const batches = useTrackStore((s) => s.batches);
  const loadSamplePack = useTrackStore((s) => s.loadSamplePack);

  useEffect(() => {
    if (!batches || batches.length === 0) {
      const stored = localStorage.getItem('track-store');
      let hasData = false;
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed?.state?.batches && parsed.state.batches.length > 0) {
            hasData = true;
          }
        } catch {
          hasData = false;
        }
      }
      if (!hasData) {
        loadSamplePack();
      }
    }
  }, [batches, loadSamplePack]);

  return (
    <HashRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/tracker" element={<TrackerPage />} />
          <Route path="/collision" element={<CollisionPage />} />
          <Route path="/history" element={<HistoryPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
