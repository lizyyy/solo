import React from 'react';
import { Routes, Route } from 'react-router-dom';
import ServiceList from './pages/ServiceList';
import ServiceDetail from './pages/ServiceDetail';

function App() {
  return (
    <div className="container">
      <div className="header">
        <h1>🔬 依赖健康检查台</h1>
        <p>实时监控服务依赖状态，快速发现和定位问题</p>
      </div>
      <Routes>
        <Route path="/" element={<ServiceList />} />
        <Route path="/service/:id" element={<ServiceDetail />} />
      </Routes>
    </div>
  );
}

export default App;
