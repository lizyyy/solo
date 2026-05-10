import React from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import KeysPage from './pages/KeysPage';
import OrdersPage from './pages/OrdersPage';
import AuditPage from './pages/AuditPage';

function App() {
  return (
    <div className="app-container">
      <nav className="navbar">
        <h1>🔑 家政保洁钥匙交接台</h1>
        <div className="nav-links">
          <NavLink className="nav-link" activeClassName="active" exact to="/">
            首页
          </NavLink>
          <NavLink className="nav-link" activeClassName="active" to="/keys">
            钥匙管理
          </NavLink>
          <NavLink className="nav-link" activeClassName="active" to="/orders">
            订单管理
          </NavLink>
          <NavLink className="nav-link" activeClassName="active" to="/audit">
            审计追踪
          </NavLink>
        </div>
      </nav>
      
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/keys" element={<KeysPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/audit" element={<AuditPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
