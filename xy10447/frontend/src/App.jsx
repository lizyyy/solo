import React from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import MoviesPage from './pages/MoviesPage.jsx';
import HallsPage from './pages/HallsPage.jsx';
import SchedulesPage from './pages/SchedulesPage.jsx';
import TicketsPage from './pages/TicketsPage.jsx';
import HallExchangePage from './pages/HallExchangePage.jsx';
import HallExchangeDetailPage from './pages/HallExchangeDetailPage.jsx';

export default function App() {
  return (
    <div className="app-container">
      <header className="header">
        <h1>🎬 影院排片换厅台</h1>
        <nav className="nav">
          <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>
            换厅工作台
          </NavLink>
          <NavLink to="/movies" className={({ isActive }) => isActive ? 'active' : ''}>
            影片管理
          </NavLink>
          <NavLink to="/halls" className={({ isActive }) => isActive ? 'active' : ''}>
            影厅管理
          </NavLink>
          <NavLink to="/schedules" className={({ isActive }) => isActive ? 'active' : ''}>
            排片管理
          </NavLink>
          <NavLink to="/tickets" className={({ isActive }) => isActive ? 'active' : ''}>
            售票记录
          </NavLink>
        </nav>
      </header>
      <main className="main-content">
        <Routes>
          <Route path="/" element={<HallExchangePage />} />
          <Route path="/exchange/:id" element={<HallExchangeDetailPage />} />
          <Route path="/movies" element={<MoviesPage />} />
          <Route path="/halls" element={<HallsPage />} />
          <Route path="/schedules" element={<SchedulesPage />} />
          <Route path="/tickets" element={<TicketsPage />} />
        </Routes>
      </main>
    </div>
  );
}
