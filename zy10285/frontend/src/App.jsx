import React from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import CapacityAlerts from './pages/CapacityAlerts'
import Billing from './pages/Billing'
import Customers from './pages/Customers'
import Coolers from './pages/Coolers'

function App() {
  return (
    <div>
      <header className="header">
        <div className="container">
          <h1>🧊 桶装冰块配送台</h1>
          <nav className="nav">
            <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>
              配送看板
            </NavLink>
            <NavLink to="/capacity" className={({ isActive }) => isActive ? 'active' : ''}>
              产能预警
            </NavLink>
            <NavLink to="/billing" className={({ isActive }) => isActive ? 'active' : ''}>
              客户账单
            </NavLink>
            <NavLink to="/customers" className={({ isActive }) => isActive ? 'active' : ''}>
              客户管理
            </NavLink>
            <NavLink to="/coolers" className={({ isActive }) => isActive ? 'active' : ''}>
              保温箱管理
            </NavLink>
          </nav>
        </div>
      </header>
      
      <main className="container">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/capacity" element={<CapacityAlerts />} />
          <Route path="/billing" element={<Billing />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/coolers" element={<Coolers />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
