import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { Batch } from './types';
import { batchApi } from './api';
import Dashboard from './pages/Dashboard';
import BatchDetail from './pages/BatchDetail';
import ImportPage from './pages/ImportPage';
import RiskQueue from './pages/RiskQueue';

function App() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    loadBatches();
  }, []);

  const loadBatches = async () => {
    try {
      const data = await batchApi.getAll();
      setBatches(data);
    } catch (error) {
      console.error('Failed to load batches:', error);
    } finally {
      setLoading(false);
    }
  };

  const navItems = [
    { path: '/', label: '仪表盘', icon: '📊' },
    { path: '/risk-queue', label: '风险队列', icon: '⚠️' },
    { path: '/import', label: '数据导入', icon: '📥' }
  ];

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <h1 className="logo">🎨 染坊色差复盘台</h1>
          <nav className="nav">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
              >
                <span className="nav-icon">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard batches={batches} onRefresh={loadBatches} />} />
          <Route path="/batch/:id" element={<BatchDetail />} />
          <Route path="/risk-queue" element={<RiskQueue />} />
          <Route path="/import" element={<ImportPage onImportSuccess={loadBatches} />} />
        </Routes>
      </main>

      <footer className="footer">
        <p>染坊色差复盘台系统 v1.0</p>
      </footer>
    </div>
  );
}

export default App;
