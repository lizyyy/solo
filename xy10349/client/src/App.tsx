import { Routes, Route, NavLink } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import StudentsPage from './pages/StudentsPage';
import AttendancePage from './pages/AttendancePage';
import LeavesPage from './pages/LeavesPage';
import GroupChangesPage from './pages/GroupChangesPage';
import ReportsPage from './pages/ReportsPage';

export default function App() {
  return (
    <div className="app-container">
      <nav className="navbar">
        <div className="navbar-content">
          <div className="navbar-brand">
            <span>📋</span>
            <span>研学活动安全点名台</span>
          </div>
          <div className="navbar-links">
            <NavLink to="/">看板</NavLink>
            <NavLink to="/students">学生管理</NavLink>
            <NavLink to="/attendance">点名</NavLink>
            <NavLink to="/leaves">请假审批</NavLink>
            <NavLink to="/group-changes">换组历史</NavLink>
            <NavLink to="/reports">报表导出</NavLink>
          </div>
        </div>
      </nav>

      <main className="main-content">
        <div className="content-wrapper">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/students" element={<StudentsPage />} />
            <Route path="/attendance" element={<AttendancePage />} />
            <Route path="/leaves" element={<LeavesPage />} />
            <Route path="/group-changes" element={<GroupChangesPage />} />
            <Route path="/reports" element={<ReportsPage />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
