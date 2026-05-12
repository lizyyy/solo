import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { BatchList } from './pages/BatchList';
import { BatchDetail } from './pages/BatchDetail';
import { TenantDetail } from './pages/TenantDetail';

function App() {
  return (
    <BrowserRouter>
      <div className="header">
        <div className="container">
          <h1>租户迁移校验台</h1>
          <p>私有化租户新集群迁移校验工具 - 确保数据完整、权限正确、任务正常、回调就绪</p>
        </div>
      </div>
      <div className="container">
        <Routes>
          <Route path="/" element={<BatchList />} />
          <Route path="/batches/:id" element={<BatchDetail />} />
          <Route path="/tenants/:id" element={<TenantDetail />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
