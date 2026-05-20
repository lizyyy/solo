import React, { useState, useEffect } from 'react'
import StatsPanel from './components/StatsPanel'
import AbnormalQueue from './components/AbnormalQueue'
import DeviceList from './components/DeviceList'
import CommandHistory from './components/CommandHistory'
import CreateCommandModal from './components/CreateCommandModal'

function App() {
  const [activeTab, setActiveTab] = useState('abnormal')
  const [stats, setStats] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats')
      const data = await res.json()
      setStats(data)
    } catch (err) {
      console.error('Failed to fetch stats:', err)
    }
  }

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 10000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="app">
      <div className="header">
        <h1>🔌 网关离线指令队列</h1>
        <p>Gateway Offline Command Queue Management System</p>
      </div>

      <StatsPanel stats={stats} />

      <div className="tabs">
        <button 
          className={`tab-btn ${activeTab === 'abnormal' ? 'active' : ''}`}
          onClick={() => setActiveTab('abnormal')}
        >
          ⚠️ 异常队列
        </button>
        <button 
          className={`tab-btn ${activeTab === 'devices' ? 'active' : ''}`}
          onClick={() => setActiveTab('devices')}
        >
          📱 网关设备
        </button>
        <button 
          className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          📜 历史轨迹
        </button>
        <button 
          className={`tab-btn ${activeTab === 'commands' ? 'active' : ''}`}
          onClick={() => setActiveTab('commands')}
        >
          📋 全部指令
        </button>
      </div>

      {activeTab === 'abnormal' && (
        <AbnormalQueue onRefresh={fetchStats} />
      )}
      
      {activeTab === 'devices' && (
        <DeviceList onRefresh={fetchStats} onCreateCommand={() => setShowCreateModal(true)} />
      )}
      
      {activeTab === 'history' && (
        <CommandHistory filter="all" onRefresh={fetchStats} />
      )}
      
      {activeTab === 'commands' && (
        <CommandHistory filter="all" showAll={true} onRefresh={fetchStats} />
      )}

      {showCreateModal && (
        <CreateCommandModal 
          onClose={() => setShowCreateModal(false)} 
          onSuccess={fetchStats}
        />
      )}
    </div>
  )
}

export default App
