import React from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard.jsx';
import PlansPage from './pages/PlansPage.jsx';
import CustomersPage from './pages/CustomersPage.jsx';
import CustomerDetail from './pages/CustomerDetail.jsx';

function App() {
  return (
    <div className="layout">
      <header className="header">
        <h1>API 速率套餐台</h1>
        <p>管理客户订阅、实时监控用量、智能账单预估</p>
      </header>
      
      <nav className="nav">
        <ul className="nav-list">
          <li>
            <NavLink className="nav-link" to="/" end>
              仪表盘
            </NavLink>
          </li>
          <li>
            <NavLink className="nav-link" to="/plans">
              套餐管理
            </NavLink>
          </li>
          <li>
            <NavLink className="nav-link" to="/customers">
              客户管理
            </NavLink>
          </li>
        </ul>
      </nav>
      
      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/plans" element={<PlansPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/customers/:id" element={<CustomerDetail />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
