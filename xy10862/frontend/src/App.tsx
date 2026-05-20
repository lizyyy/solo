import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Tasks from './pages/Tasks'
import Locks from './pages/Locks'
import ExecutionLogs from './pages/ExecutionLogs'
import AbnormalQueue from './pages/AbnormalQueue'
import './App.css'

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  const location = useLocation()
  const isActive = location.pathname === to
  
  return (
    <Link to={to} className={`nav-link ${isActive ? 'active' : ''}`}>
      {children}
    </Link>
  )
}

function App() {
  return (
    <Router>
      <div className="app">
        <header className="header">
          <div className="header-content">
            <h1 className="title">🔒 定时任务互斥锁管理系统</h1>
            <nav className="nav">
              <NavLink to="/">仪表盘</NavLink>
              <NavLink to="/tasks">任务管理</NavLink>
              <NavLink to="/locks">锁状态</NavLink>
              <NavLink to="/logs">执行日志</NavLink>
              <NavLink to="/abnormal">异常队列</NavLink>
            </nav>
          </div>
        </header>
        
        <main className="main">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/locks" element={<Locks />} />
            <Route path="/logs" element={<ExecutionLogs />} />
            <Route path="/abnormal" element={<AbnormalQueue />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}

export default App
