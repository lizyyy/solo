import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Plans from './pages/Plans';
import Customers from './pages/Customers';
import Claims from './pages/Claims';
import Express from './pages/Express';
import Returns from './pages/Returns';
import Exceptions from './pages/Exceptions';
import Reports from './pages/Reports';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/plans" element={<Plans />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/claims" element={<Claims />} />
        <Route path="/express" element={<Express />} />
        <Route path="/returns" element={<Returns />} />
        <Route path="/exceptions" element={<Exceptions />} />
        <Route path="/reports" element={<Reports />} />
      </Routes>
    </Layout>
  );
}

export default App;
