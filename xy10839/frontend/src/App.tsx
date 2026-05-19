import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import TaskDetail from './pages/TaskDetail';

function App() {
  return (
    <div>
      <div className="header">
        <div className="container">
          <h1>🗄️ 租户数据打包出口</h1>
          <p>大客户离线备份数据服务 - 同时获取文件、元数据和导出证明</p>
        </div>
      </div>
      <div className="container">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/task/:taskId" element={<TaskDetail />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
