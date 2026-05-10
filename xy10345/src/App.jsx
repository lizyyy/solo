import React from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Properties from './pages/Properties';
import Calendar from './pages/Calendar';
import Passwords from './pages/Passwords';
import CreatePassword from './pages/CreatePassword';
import Anomalies from './pages/Anomalies';
import Reports from './pages/Reports';

function App() {
  return (
    <div className="app-container">
      <aside className="sidebar">
        <h1>🔐 门锁密码轮换台</h1>
        <nav>
          <ul>
            <li>
              <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>
                📊 总览
              </NavLink>
            </li>
            <li>
              <NavLink to="/properties" className={({ isActive }) => isActive ? 'active' : ''}>
                🏠 房源管理
              </NavLink>
            </li>
            <li>
              <NavLink to="/calendar" className={({ isActive }) => isActive ? 'active' : ''}>
                📅 房源日历
              </NavLink>
            </li>
            <li>
              <NavLink to="/passwords" className={({ isActive }) => isActive ? 'active' : ''}>
                🔑 密码管理
              </NavLink>
            </li>
            <li>
              <NavLink to="/create-password" className={({ isActive }) => isActive ? 'active' : ''}>
                ➕ 生成密码
              </NavLink>
            </li>
            <li>
              <NavLink to="/anomalies" className={({ isActive }) => isActive ? 'active' : ''}>
                ⚠️ 异常提醒
              </NavLink>
            </li>
            <li>
              <NavLink to="/reports" className={({ isActive }) => isActive ? 'active' : ''}>
                📋 审计报告
              </NavLink>
            </li>
          </ul>
        </nav>
      </aside>
      
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/properties" element={<Properties />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/passwords" element={<Passwords />} />
          <Route path="/create-password" element={<CreatePassword />} />
          <Route path="/anomalies" element={<Anomalies />} />
          <Route path="/reports" element={<Reports />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
