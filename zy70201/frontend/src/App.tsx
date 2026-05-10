import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import SlopesPage from './pages/SlopesPage';
import VehiclesPage from './pages/VehiclesPage';
import TasksPage from './pages/TasksPage';
import ReportsPage from './pages/ReportsPage';
import DashboardPage from './pages/DashboardPage';

function App() {
  return (
    <div>
      <nav className="navbar">
        <div className="navbar-inner">
          <div className="navbar-brand">
            ❄️ 滑雪场压雪排程台
          </div>
          <div className="navbar-nav">
            <NavLink to="/dashboard" className="nav-link">
              📊 总览
            </NavLink>
            <NavLink to="/slopes" className="nav-link">
              🎿 雪道档案
            </NavLink>
            <NavLink to="/vehicles" className="nav-link">
              🚜 车辆状态
            </NavLink>
            <NavLink to="/tasks" className="nav-link">
              📋 任务排程
            </NavLink>
            <NavLink to="/reports" className="nav-link">
              📑 作业报告
            </NavLink>
          </div>
        </div>
      </nav>
      
      <div className="container">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/slopes" element={<SlopesPage />} />
          <Route path="/vehicles" element={<VehiclesPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/reports" element={<ReportsPage />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
