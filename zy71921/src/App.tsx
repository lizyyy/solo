import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import Materials from '@/pages/Materials';
import Timeline from '@/pages/Timeline';
import Exceptions from '@/pages/Exceptions';
import Export from '@/pages/Export';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="materials" element={<Materials />} />
          <Route path="timeline" element={<Timeline />} />
          <Route path="exceptions" element={<Exceptions />} />
          <Route path="export" element={<Export />} />
        </Route>
      </Routes>
    </Router>
  );
}
