import React, { useEffect } from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Slots from './pages/Slots';
import SlotDetail from './pages/SlotDetail';
import Locks from './pages/Locks';
import Vouchers from './pages/Vouchers';
import Conflicts from './pages/Conflicts';
import Systems from './pages/Systems';
import ImportExport from './pages/ImportExport';
import { useAppStore } from './store';

function App() {
  const location = useLocation();
  const { notification, clearNotification } = useAppStore();

  useEffect(() => {
    if (notification.type) {
      const timer = setTimeout(clearNotification, 3000);
      return () => clearTimeout(timer);
    }
  }, [notification, clearNotification]);

  return (
    <div>
      <header className="header">
        <div className="container">
          <h1>🏥 预约号源整合 API</h1>
          <p>多系统号源统一管理平台</p>
          <nav className="nav">
            <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>
              仪表盘
            </NavLink>
            <NavLink to="/slots" className={({ isActive }) => isActive ? 'active' : ''}>
              号源管理
            </NavLink>
            <NavLink to="/locks" className={({ isActive }) => isActive ? 'active' : ''}>
              锁号记录
            </NavLink>
            <NavLink to="/vouchers" className={({ isActive }) => isActive ? 'active' : ''}>
              预约凭证
            </NavLink>
            <NavLink to="/conflicts" className={({ isActive }) => isActive ? 'active' : ''}>
              冲突处理
            </NavLink>
            <NavLink to="/systems" className={({ isActive }) => isActive ? 'active' : ''}>
              外部系统
            </NavLink>
            <NavLink to="/import-export" className={({ isActive }) => isActive ? 'active' : ''}>
              导入导出
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="container">
        {notification.type && (
          <div className={`alert alert-${notification.type}`}>
            {notification.message}
          </div>
        )}
        
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/slots" element={<Slots />} />
          <Route path="/slots/:id" element={<SlotDetail />} />
          <Route path="/locks" element={<Locks />} />
          <Route path="/vouchers" element={<Vouchers />} />
          <Route path="/conflicts" element={<Conflicts />} />
          <Route path="/systems" element={<Systems />} />
          <Route path="/import-export" element={<ImportExport />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
