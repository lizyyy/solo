import React from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import RequestList from './pages/RequestList';
import RequestDetail from './pages/RequestDetail';
import CreateRequest from './pages/CreateRequest';

function App() {
  const location = useLocation();

  return (
    <div>
      <header className="header">
        <h1>数据保留删除管理系统</h1>
        <nav className="nav">
          <Link to="/" className={location.pathname === '/' ? 'active' : ''}>总览</Link>
          <Link to="/requests" className={location.pathname.startsWith('/requests') ? 'active' : ''}>删除申请</Link>
        </nav>
      </header>
      <div className="container">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/requests" element={<RequestList />} />
          <Route path="/requests/:id" element={<RequestDetail />} />
          <Route path="/create" element={<CreateRequest />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
