import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import MapPage from './pages/MapPage';
import FeedbacksPage from './pages/FeedbacksPage';
import PlansPage from './pages/PlansPage';
import ConflictsPage from './pages/ConflictsPage';
import ReportsPage from './pages/ReportsPage';

function App() {
  const location = useLocation();

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>🌳 树木修剪排程</h1>
          <p>城市树木管理系统</p>
        </div>
        <nav>
          <ul className="nav-menu">
            <li className="nav-item">
              <NavLink to="/" className="nav-link">
                📊 数据看板
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink to="/map" className="nav-link">
                🗺️ GIS点位
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink to="/feedbacks" className="nav-link">
                📝 居民反馈
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink to="/plans" className="nav-link">
                📋 修剪方案
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink to="/conflicts" className="nav-link">
                ⚠️ 数据冲突
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink to="/reports" className="nav-link">
                📑 报告管理
              </NavLink>
            </li>
          </ul>
        </nav>
      </aside>

      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/feedbacks" element={<FeedbacksPage />} />
          <Route path="/plans" element={<PlansPage />} />
          <Route path="/conflicts" element={<ConflictsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
