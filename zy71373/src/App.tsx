import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from './components/Layout';
import AuditWorkbench from './pages/AuditWorkbench';
import Dashboard from './pages/Dashboard';
import Fonts from './pages/Fonts';
import Licenses from './pages/Licenses';
import Projects from './pages/Projects';
import Channels from './pages/Channels';
import Reports from './pages/Reports';
import ReportDetail from './pages/ReportDetail';
import Regression from './pages/Regression';

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<AuditWorkbench />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/fonts" element={<Fonts />} />
          <Route path="/licenses" element={<Licenses />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/channels" element={<Channels />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/reports/:id" element={<ReportDetail />} />
          <Route path="/regression" element={<Regression />} />
        </Routes>
      </Layout>
    </Router>
  );
}
