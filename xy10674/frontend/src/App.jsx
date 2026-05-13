import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import StoreCollectionList from './pages/StoreCollectionList';
import StoreCollectionDetail from './pages/StoreCollectionDetail';
import OperationLogs from './pages/OperationLogs';
import ExportCenter from './pages/ExportCenter';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/collections" element={<StoreCollectionList />} />
        <Route path="/collections/:id" element={<StoreCollectionDetail />} />
        <Route path="/logs" element={<OperationLogs />} />
        <Route path="/export" element={<ExportCenter />} />
      </Routes>
    </Layout>
  );
}

export default App;
