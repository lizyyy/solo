import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import TraceAnalysis from '@/pages/TraceAnalysis';
import AnomalyDetail from '@/pages/AnomalyDetail';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/trace" element={<TraceAnalysis />} />
          <Route path="/anomaly/:id" element={<AnomalyDetail />} />
        </Route>
      </Routes>
    </Router>
  );
}
