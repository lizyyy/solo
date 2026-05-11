import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import CourierCompaniesPage from './pages/CourierCompaniesPage';
import RetentionRulesPage from './pages/RetentionRulesPage';
import PackagesPage from './pages/PackagesPage';
import SettlementsPage from './pages/SettlementsPage';

function App() {
  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-title">乡村快递共配结算台</div>
        <ul className="sidebar-nav">
          <li>
            <NavLink to="/" end>
              <span>📊</span> 数据概览
            </NavLink>
          </li>
          <li>
            <NavLink to="/companies">
              <span>🏢</span> 快递公司
            </NavLink>
          </li>
          <li>
            <NavLink to="/rules">
              <span>📋</span> 滞留规则
            </NavLink>
          </li>
          <li>
            <NavLink to="/packages">
              <span>📦</span> 包裹管理
            </NavLink>
          </li>
          <li>
            <NavLink to="/settlements">
              <span>💰</span> 结算中心
            </NavLink>
          </li>
        </ul>
      </aside>
      <main className="main-content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/companies" element={<CourierCompaniesPage />} />
          <Route path="/rules" element={<RetentionRulesPage />} />
          <Route path="/packages" element={<PackagesPage />} />
          <Route path="/settlements" element={<SettlementsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
