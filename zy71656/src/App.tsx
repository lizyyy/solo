import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.js';
import Dashboard from './pages/Dashboard.js';
import Calculator from './pages/Calculator.js';
import Settlements from './pages/Settlements.js';
import DataManagement from './pages/DataManagement.js';
import AuditTrail from './pages/AuditTrail.js';

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/calculator" element={<Calculator />} />
          <Route path="/settlements" element={<Settlements />} />
          <Route path="/data" element={<DataManagement />} />
          <Route path="/audit" element={<AuditTrail />} />
        </Routes>
      </Layout>
    </Router>
  );
}
