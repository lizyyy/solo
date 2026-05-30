import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from '@/components/Layout';
import ExceptionDrawer from '@/components/ExceptionDrawer';
import Dashboard from '@/pages/Dashboard';
import BondManagement from '@/pages/BondManagement';
import CurveManagement from '@/pages/CurveManagement';
import Calculator from '@/pages/Calculator';
import ReportCenter from '@/pages/ReportCenter';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="bonds" element={<BondManagement />} />
          <Route path="curves" element={<CurveManagement />} />
          <Route path="calculator" element={<Calculator />} />
          <Route path="reports" element={<ReportCenter />} />
        </Route>
      </Routes>
      <ExceptionDrawer />
    </BrowserRouter>
  );
}
