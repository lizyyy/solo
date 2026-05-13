import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import PackagesPage from './pages/PackagesPage';
import TicketsPage from './pages/TicketsPage';
import ResubmitPage from './pages/ResubmitPage';
import PackageDetailPage from './pages/PackageDetailPage';
import ImportPage from './pages/ImportPage';
import './App.css';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<PackagesPage />} />
        <Route path="/packages" element={<PackagesPage />} />
        <Route path="/packages/:id" element={<PackageDetailPage />} />
        <Route path="/tickets" element={<TicketsPage />} />
        <Route path="/resubmit" element={<ResubmitPage />} />
        <Route path="/import" element={<ImportPage />} />
      </Routes>
    </Layout>
  );
}

export default App;
