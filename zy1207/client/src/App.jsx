import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MainLayout from './components/MainLayout';
import Dashboard from './pages/Dashboard';
import Interfaces from './pages/Interfaces';
import TrafficModels from './pages/TrafficModels';
import TestBatches from './pages/TestBatches';
import Analysis from './pages/Analysis';
import Tasks from './pages/Tasks';
import BatchDetail from './pages/BatchDetail';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="interfaces" element={<Interfaces />} />
          <Route path="traffic-models" element={<TrafficModels />} />
          <Route path="test-batches" element={<TestBatches />} />
          <Route path="test-batches/:id" element={<BatchDetail />} />
          <Route path="analysis" element={<Analysis />} />
          <Route path="tasks" element={<Tasks />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
