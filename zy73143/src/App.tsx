import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import BuoyLogs from '@/pages/BuoyLogs';
import SpatialMarking from '@/pages/SpatialMarking';
import Anomalies from '@/pages/Anomalies';
import Audit from '@/pages/Audit';
import BuoyLogDetail from '@/components/BuoyLogDetail';
import ImportModal from '@/components/ImportModal';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/buoy-logs" element={<BuoyLogs />} />
          <Route path="/spatial-marking" element={<SpatialMarking />} />
          <Route path="/anomalies" element={<Anomalies />} />
          <Route path="/audit" element={<Audit />} />
        </Route>
      </Routes>
      <BuoyLogDetail />
      <ImportModal />
    </Router>
  );
}
