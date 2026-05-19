import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import Dashboard from './pages/Dashboard';
import PickupOrders from './pages/PickupOrders';
import RepairOrders from './pages/RepairOrders';
import ClaimOrders from './pages/ClaimOrders';
import DataImport from './pages/DataImport';
import ReportCenter from './pages/ReportCenter';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/pickup" element={<PickupOrders />} />
          <Route path="/repair" element={<RepairOrders />} />
          <Route path="/claim" element={<ClaimOrders />} />
          <Route path="/import" element={<DataImport />} />
          <Route path="/report" element={<ReportCenter />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
