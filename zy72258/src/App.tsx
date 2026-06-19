import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Overview } from './pages/Overview';
import { CoordinateOrigin } from './pages/CoordinateOrigin';
import { SelfCheck } from './pages/SelfCheck';
import { WorkflowPage } from './pages/Workflow';
import { AuditLogPage } from './pages/AuditLogPage';
import { initDatabase } from './db';
import { useCanonicalStore } from './store/canonicalStore';

export default function App() {
  const initWorkflow = useCanonicalStore(s => s.initWorkflow);

  useEffect(() => {
    (async () => {
      await initDatabase();
      await initWorkflow();
    })();
  }, [initWorkflow]);

  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/overview" element={<Overview />} />
          <Route path="/coordinate-origin" element={<CoordinateOrigin />} />
          <Route path="/self-check" element={<SelfCheck />} />
          <Route path="/workflow" element={<WorkflowPage />} />
          <Route path="/audit-log" element={<AuditLogPage />} />
        </Routes>
      </Layout>
    </Router>
  );
}
