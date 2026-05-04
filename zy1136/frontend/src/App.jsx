import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import Dashboard from '../pages/Dashboard';
import NetworkView from '../pages/NetworkView';
import RiskList from '../pages/RiskList';
import ChangeOrder from '../pages/ChangeOrder';
import AlertHandler from '../pages/AlertHandler';
import ImportPage from '../pages/ImportPage';
import ReportPage from '../pages/ReportPage';

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="network" element={<NetworkView />} />
          <Route path="topology" element={<RiskList />} />
          <Route path="risks" element={<RiskList />} />
          <Route path="changes" element={<ChangeOrder />} />
          <Route path="alerts" element={<AlertHandler />} />
          <Route path="import" element={<ImportPage />} />
          <Route path="reports" element={<ReportPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
