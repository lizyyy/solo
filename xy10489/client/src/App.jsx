import React, { useState, useEffect } from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  AlertTriangle, 
  ClipboardList, 
  FileSpreadsheet,
  Settings 
} from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Batches from './pages/Batches';
import BatchDetail from './pages/BatchDetail';
import Defects from './pages/Defects';
import History from './pages/History';
import Reports from './pages/Reports';
import api from './utils/api';

function App() {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    checkAndInit();
  }, []);

  const checkAndInit = async () => {
    try {
      const health = await api.get('/api/health');
      if (health.data.status === 'ok') {
        setInitialized(true);
        await api.post('/api/init-sample');
      }
    } catch (err) {
      console.error('系统连接失败:', err);
    }
  };

  if (!initialized) {
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="loading">
          <div className="spinner"></div>
          <p style={{ marginTop: '1rem' }}>正在连接服务器...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>品控抽检复判台</h1>
          <p>品质管理系统</p>
        </div>
        <nav className="nav-menu">
          <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end>
            <LayoutDashboard size={18} />
            <span>概览仪表盘</span>
          </NavLink>
          <NavLink to="/batches" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Package size={18} />
            <span>批次管理</span>
          </NavLink>
          <NavLink to="/defects" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <AlertTriangle size={18} />
            <span>缺陷管理</span>
          </NavLink>
          <NavLink to="/history" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <ClipboardList size={18} />
            <span>复判历史</span>
          </NavLink>
          <NavLink to="/reports" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <FileSpreadsheet size={18} />
            <span>质量月报</span>
          </NavLink>
        </nav>
      </aside>
      
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/batches" element={<Batches />} />
          <Route path="/batches/:id" element={<BatchDetail />} />
          <Route path="/defects" element={<Defects />} />
          <Route path="/history" element={<History />} />
          <Route path="/reports" element={<Reports />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
