import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import Vendors from '@/pages/Vendors';
import Stalls from '@/pages/Stalls';
import Arrange from '@/pages/Arrange';
import History from '@/pages/History';
import Export from '@/pages/Export';
import { useMarketStore } from '@/store/useMarketStore';
import Toast from '@/components/Toast';

export default function App() {
  const { loadAll } = useMarketStore();

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  return (
    <Router>
      <Toast />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/vendors" element={<Vendors />} />
          <Route path="/stalls" element={<Stalls />} />
          <Route path="/arrange" element={<Arrange />} />
          <Route path="/history" element={<History />} />
          <Route path="/export" element={<Export />} />
        </Route>
      </Routes>
    </Router>
  );
}
