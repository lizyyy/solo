import React from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import Credits from './pages/Credits'
import CreditDetail from './pages/CreditDetail'
import Orders from './pages/Orders'
import Repayments from './pages/Repayments'
import Extensions from './pages/Extensions'
import Collections from './pages/Collections'
import Report from './pages/Report'
import SampleData from './pages/SampleData'

function App() {
  return (
    <div className="app-container">
      <div className="app-header">
        <h1>农资赊销授信回款系统</h1>
      </div>
      
      <nav className="nav-tabs">
        <NavLink to="/credits" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
          授信管理
        </NavLink>
        <NavLink to="/orders" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
          赊销订单
        </NavLink>
        <NavLink to="/repayments" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
          季节还款
        </NavLink>
        <NavLink to="/extensions" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
          展期审批
        </NavLink>
        <NavLink to="/collections" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
          催收清单
        </NavLink>
        <NavLink to="/report" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
          责任报告
        </NavLink>
        <NavLink to="/sample" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
          样例演示
        </NavLink>
      </nav>

      <Routes>
        <Route path="/" element={<Credits />} />
        <Route path="/credits" element={<Credits />} />
        <Route path="/credits/:id" element={<CreditDetail />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/repayments" element={<Repayments />} />
        <Route path="/extensions" element={<Extensions />} />
        <Route path="/collections" element={<Collections />} />
        <Route path="/report" element={<Report />} />
        <Route path="/sample" element={<SampleData />} />
      </Routes>
    </div>
  )
}

export default App
