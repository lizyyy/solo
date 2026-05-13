import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MainLayout from './components/Layout/MainLayout';
import Dashboard from './pages/Dashboard';
import PlateBinding from './pages/PlateBinding';
import Arrears from './pages/Arrears';
import Renewal from './pages/Renewal';
import Blacklist from './pages/Blacklist';
import FlowRecords from './pages/FlowRecords';
import Reports from './pages/Reports';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="plate-binding" element={<PlateBinding />} />
          <Route path="arrears" element={<Arrears />} />
          <Route path="renewal" element={<Renewal />} />
          <Route path="blacklist" element={<Blacklist />} />
          <Route path="flow-records" element={<FlowRecords />} />
          <Route path="reports" element={<Reports />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
