import React, { useState, useEffect } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Batches from './pages/Batches'
import BatchDetail from './pages/BatchDetail'
import Deliveries from './pages/Deliveries'
import DeliveryDetail from './pages/DeliveryDetail'
import Discrepancies from './pages/Discrepancies'
import DiscrepancyDetail from './pages/DiscrepancyDetail'
import Sync from './pages/Sync'

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard')
  const navigate = useNavigate()

  const handleNavClick = (page) => {
    setCurrentPage(page)
    navigate(page === 'dashboard' ? '/' : `/${page}`)
  }

  return (
    <div className="layout">
      <header className="header">
        <h1>💊 药品库存接口台</h1>
        <span>Inventory Console v1.1</span>
      </header>
      <main className="main">
        <nav className="nav">
          <button 
            className={`nav-btn ${currentPage === 'dashboard' ? 'active' : ''}`}
            onClick={() => handleNavClick('dashboard')}
          >
            总览
          </button>
          <button 
            className={`nav-btn ${currentPage === 'batches' ? 'active' : ''}`}
            onClick={() => handleNavClick('batches')}
          >
            库存批次
          </button>
          <button 
            className={`nav-btn ${currentPage === 'deliveries' ? 'active' : ''}`}
            onClick={() => handleNavClick('deliveries')}
          >
            配送管理
          </button>
          <button 
            className={`nav-btn ${currentPage === 'discrepancies' ? 'active' : ''}`}
            onClick={() => handleNavClick('discrepancies')}
          >
            差异处理
          </button>
          <button 
            className={`nav-btn ${currentPage === 'sync' ? 'active' : ''}`}
            onClick={() => handleNavClick('sync')}
          >
            多源同步
          </button>
        </nav>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/batches" element={<Batches />} />
          <Route path="/batches/:id" element={<BatchDetail />} />
          <Route path="/deliveries" element={<Deliveries />} />
          <Route path="/deliveries/:id" element={<DeliveryDetail />} />
          <Route path="/discrepancies" element={<Discrepancies />} />
          <Route path="/discrepancies/:id" element={<DiscrepancyDetail />} />
          <Route path="/sync" element={<Sync />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
