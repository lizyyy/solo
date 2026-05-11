import React from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard.jsx';
import WorkOrders from './pages/WorkOrders.jsx';
import WorkOrderDetail from './pages/WorkOrderDetail.jsx';
import Materials from './pages/Materials.jsx';
import Settlements from './pages/Settlements.jsx';

function App() {
  return (
    <div className="app">
      <nav className="navbar">
        <div className="navbar-inner">
          <div className="navbar-brand">
            <span>🔧</span>
            <span>社区维修材料核销台</span>
          </div>
          <div className="navbar-nav">
            <NavLink to="/" className="nav-link" end>
              📊 看板
            </NavLink>
            <NavLink to="/work-orders" className="nav-link">
              📋 工单管理
            </NavLink>
            <NavLink to="/materials" className="nav-link">
              📦 材料库存
            </NavLink>
            <NavLink to="/settlements" className="nav-link">
              💰 结算记录
            </NavLink>
          </div>
        </div>
      </nav>
      <div className="container">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/work-orders" element={<WorkOrders />} />
          <Route path="/work-orders/:id" element={<WorkOrderDetail />} />
          <Route path="/materials" element={<Materials />} />
          <Route path="/settlements" element={<Settlements />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
