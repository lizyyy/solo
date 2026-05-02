import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Rooms from './pages/Rooms';
import Guests from './pages/Guests';
import Ships from './pages/Ships';
import Supplies from './pages/Supplies';
import Batches from './pages/Batches';
import Export from './pages/Export';
import { useAppStore } from './store/store';

function App() {
  const { fetchAll } = useAppStore();

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/rooms" element={<Rooms />} />
        <Route path="/guests" element={<Guests />} />
        <Route path="/ships" element={<Ships />} />
        <Route path="/supplies" element={<Supplies />} />
        <Route path="/batches" element={<Batches />} />
        <Route path="/export" element={<Export />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default App;
