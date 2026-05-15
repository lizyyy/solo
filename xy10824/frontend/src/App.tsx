import React from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Reservations from './pages/Reservations';
import Inventory from './pages/Inventory';
import FailedReleases from './pages/FailedReleases';

function App() {
  return (
    <div className="app">
      <header className="header">
        <h1>库存预占状态机</h1>
        <nav className="nav">
          <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>
            总览
          </NavLink>
          <NavLink to="/reservations" className={({ isActive }) => isActive ? 'active' : ''}>
            预占单
          </NavLink>
          <NavLink to="/inventory" className={({ isActive }) => isActive ? 'active' : ''}>
            库存池
          </NavLink>
          <NavLink to="/failed" className={({ isActive }) => isActive ? 'active' : ''}>
            异常释放
          </NavLink>
        </nav>
      </header>
      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/reservations" element={<Reservations />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/failed" element={<FailedReleases />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;