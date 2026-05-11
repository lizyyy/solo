import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Forecast from './pages/Forecast';
import DataImport from './pages/DataImport';
import OrderManagement from './pages/OrderManagement';
import Review from './pages/Review';
import Alerts from './pages/Alerts';
import './index.css';

function App() {
  return (
    <Router>
      <div className="layout">
        <aside className="sidebar">
          <div className="sidebar-title">生鲜报货预测台</div>
          <ul className="sidebar-menu">
            <li>
              <NavLink to="/" end>
                <span>📊</span> 看板
              </NavLink>
            </li>
            <li>
              <NavLink to="/forecast">
                <span>🎯</span> 报货预测
              </NavLink>
            </li>
            <li>
              <NavLink to="/orders">
                <span>📦</span> 到货核对
              </NavLink>
            </li>
            <li>
              <NavLink to="/review">
                <span>🔍</span> 损耗复盘
              </NavLink>
            </li>
            <li>
              <NavLink to="/alerts">
                <span>⚠️</span> 异常预警
              </NavLink>
            </li>
            <li>
              <NavLink to="/import">
                <span>📥</span> 数据导入
              </NavLink>
            </li>
          </ul>
        </aside>
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/forecast" element={<Forecast />} />
            <Route path="/import" element={<DataImport />} />
            <Route path="/orders" element={<OrderManagement />} />
            <Route path="/review" element={<Review />} />
            <Route path="/alerts" element={<Alerts />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
