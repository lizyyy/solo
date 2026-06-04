import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useStore } from '@/store';
import Layout from '@/components/Layout';
import LoginPage from '@/components/LoginPage';
import DataEntry from '@/pages/DataEntry';
import Anomaly from '@/pages/Anomaly';
import History from '@/pages/History';
import SelfCheckPage from '@/pages/SelfCheck';

function AppContent() {
  const currentUser = useStore(s => s.currentUser);

  if (!currentUser) {
    return <LoginPage />;
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<DataEntry />} />
        <Route path="/anomaly" element={<Anomaly />} />
        <Route path="/history" element={<History />} />
        <Route path="/selfcheck" element={<SelfCheckPage />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}
