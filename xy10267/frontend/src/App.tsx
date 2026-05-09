import { Routes, Route, NavLink } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Aunts from './pages/Aunts'
import Customers from './pages/Customers'
import Orders from './pages/Orders'
import Assignments from './pages/Assignments'
import Leaves from './pages/Leaves'
import History from './pages/History'

function App() {
  return (
    <div>
      <nav className="nav">
        <div className="nav-content">
          <div className="nav-brand">🏠 家政阿姨技能派单台</div>
          <div className="nav-links">
            <NavLink to="/" className="nav-link" end>
              看板
            </NavLink>
            <NavLink to="/aunts" className="nav-link">
              阿姨管理
            </NavLink>
            <NavLink to="/customers" className="nav-link">
              客户管理
            </NavLink>
            <NavLink to="/orders" className="nav-link">
              订单管理
            </NavLink>
            <NavLink to="/assignments" className="nav-link">
              派单记录
            </NavLink>
            <NavLink to="/leaves" className="nav-link">
              请假管理
            </NavLink>
            <NavLink to="/history" className="nav-link">
              历史记录
            </NavLink>
          </div>
        </div>
      </nav>
      
      <div className="container">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/aunts" element={<Aunts />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/assignments" element={<Assignments />} />
          <Route path="/leaves" element={<Leaves />} />
          <Route path="/history" element={<History />} />
        </Routes>
      </div>
    </div>
  )
}

export default App
