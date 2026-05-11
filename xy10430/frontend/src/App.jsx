import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import ShipmentList from './pages/ShipmentList';
import ShipmentDetail from './pages/ShipmentDetail';
import ClaimList from './pages/ClaimList';
import ClaimDetail from './pages/ClaimDetail';
import ClaimCreate from './pages/ClaimCreate';
import ApprovalCenter from './pages/ApprovalCenter';
import Report from './pages/Report';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="shipments" element={<ShipmentList />} />
          <Route path="shipments/:id" element={<ShipmentDetail />} />
          <Route path="claims" element={<ClaimList />} />
          <Route path="claims/new" element={<ClaimCreate />} />
          <Route path="claims/:id" element={<ClaimDetail />} />
          <Route path="approval" element={<ApprovalCenter />} />
          <Route path="report" element={<Report />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
