import React, { useState, useEffect } from 'react';
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import TicketsPage from './pages/TicketsPage';
import TicketDetail from './pages/TicketDetail';
import OrdersPage from './pages/OrdersPage';
import SparePartsPage from './pages/SparePartsPage';

function App() {
  const [health, setHealth] = useState(null);

  useEffect(() => {
    fetch('/api/health')
      .then(r => r.json())
      .then(setHealth)
      .catch(() => setHealth({ status: 'error' }));
  }, []);

  return (
    <div className="app">
      <header className="header">
        <h1>🪑 Furniture CS Platform</h1>
        <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>
          {health?.status === 'ok' ? '● Connected' : '○ Disconnected'}
        </div>
      </header>
      
      <nav className="nav">
        <div className="nav-links">
          <NavLink to="/" end className="nav-link" activeClassName="active">
            Dashboard
          </NavLink>
          <NavLink to="/tickets" className="nav-link" activeClassName="active">
            Tickets
          </NavLink>
          <NavLink to="/orders" className="nav-link" activeClassName="active">
            Orders
          </NavLink>
          <NavLink to="/spare-parts" className="nav-link" activeClassName="active">
            Spare Parts
          </NavLink>
        </div>
      </nav>

      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/tickets" element={<TicketsPage />} />
        <Route path="/tickets/:id" element={<TicketDetail />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/spare-parts" element={<SparePartsPage />} />
      </Routes>
    </div>
  );
}

export default App;
