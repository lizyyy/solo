import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Devices from './pages/Devices';
import PatrolTasks from './pages/PatrolTasks';
import PatrolTaskDetail from './pages/PatrolTaskDetail';
import RepairOrders from './pages/RepairOrders';
import RepairOrderDetail from './pages/RepairOrderDetail';
import Templates from './pages/Templates';
import Workers from './pages/Workers';
import Buildings from './pages/Buildings';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="devices" element={<Devices />} />
        <Route path="patrol-tasks" element={<PatrolTasks />} />
        <Route path="patrol-tasks/:id" element={<PatrolTaskDetail />} />
        <Route path="repair-orders" element={<RepairOrders />} />
        <Route path="repair-orders/:id" element={<RepairOrderDetail />} />
        <Route path="templates" element={<Templates />} />
        <Route path="workers" element={<Workers />} />
        <Route path="buildings" element={<Buildings />} />
      </Route>
    </Routes>
  );
}

export default App;
