import React from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Home, Rope, Upload, Download } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import RopesList from './pages/RopesList';
import RopeDetail from './pages/RopeDetail';
import ImportPage from './pages/ImportPage';
import ExportPage from './pages/ExportPage';

const App = () => {
  const navLinks = [
    { path: '/', label: '仪表盘', icon: Home },
    { path: '/ropes', label: '绳索管理', icon: Rope },
    { path: '/import', label: '数据导入', icon: Upload },
    { path: '/export', label: '报告导出', icon: Download }
  ];

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>绳索安全工具</h1>
          <p>攀岩馆绳索安全复核系统</p>
        </div>
        
        <nav className="sidebar-nav">
          {navLinks.map(link => {
            const Icon = link.icon;
            return (
              <NavLink
                key={link.path}
                to={link.path}
                className="nav-link"
                end={link.path === '/'}
              >
                <Icon size={20} />
                <span>{link.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>

      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/ropes" element={<RopesList />} />
          <Route path="/ropes/:id" element={<RopeDetail />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/export" element={<ExportPage />} />
        </Routes>
      </main>

      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#fff',
            color: '#363636',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }
        }}
      />
    </div>
  );
};

export default App;
