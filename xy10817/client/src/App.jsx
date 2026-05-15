import React, { useState, useEffect } from 'react'
import StatsCard from './components/StatsCard'
import ExceptionQueue from './components/ExceptionQueue'
import TrafficBatches from './components/TrafficBatches'
import RequestLogs from './components/RequestLogs'
import EndpointManager from './components/EndpointManager'
import CreateModal from './components/CreateModal'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [stats, setStats] = useState({})
  const [exceptions, setExceptions] = useState([])
  const [batches, setBatches] = useState([])
  const [logs, setLogs] = useState([])
  const [oldEndpoints, setOldEndpoints] = useState([])
  const [newEndpoints, setNewEndpoints] = useState([])
  const [callingSystems, setCallingSystems] = useState([])
  const [compatibilityLayers, setCompatibilityLayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [modalType, setModalType] = useState('')

  useEffect(() => {
    fetchAllData()
    const interval = setInterval(fetchAllData, 5000)
    return () => clearInterval(interval)
  }, [])

  const fetchAllData = async () => {
    try {
      const [
        statsRes,
        exceptionsRes,
        batchesRes,
        logsRes,
        oldEndpointsRes,
        newEndpointsRes,
        systemsRes,
        layersRes
      ] = await Promise.all([
        fetch('/api/stats'),
        fetch('/api/exceptions'),
        fetch('/api/traffic-batches'),
        fetch('/api/request-logs'),
        fetch('/api/old-endpoints'),
        fetch('/api/new-endpoints'),
        fetch('/api/calling-systems'),
        fetch('/api/compatibility-layers')
      ])

      setStats(await statsRes.json())
      setExceptions(await exceptionsRes.json())
      setBatches(await batchesRes.json())
      setLogs(await logsRes.json())
      setOldEndpoints(await oldEndpointsRes.json())
      setNewEndpoints(await newEndpointsRes.json())
      setCallingSystems(await systemsRes.json())
      setCompatibilityLayers(await layersRes.json())
      setLoading(false)
    } catch (error) {
      console.error('数据加载失败:', error)
      setLoading(false)
    }
  }

  const openModal = (type) => {
    setModalType(type)
    setShowModal(true)
  }

  const handleCreate = async (type, data) => {
    const endpoints = {
      'old-endpoint': '/api/old-endpoints',
      'new-endpoint': '/api/new-endpoints',
      'calling-system': '/api/calling-systems',
      'compatibility-layer': '/api/compatibility-layers',
      'traffic-batch': '/api/traffic-batches'
    }

    try {
      await fetch(endpoints[type], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      setShowModal(false)
      fetchAllData()
    } catch (error) {
      console.error('创建失败:', error)
    }
  }

  const handleBatchAction = async (batchId, action, data = {}) => {
    try {
      await fetch(`/api/traffic-batches/${batchId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      fetchAllData()
    } catch (error) {
      console.error('操作失败:', error)
    }
  }

  const handleExport = (type) => {
    window.open(`/api/export/${type}`, '_blank')
  }

  if (loading) {
    return <div className="loading">加载中...</div>
  }

  return (
    <div className="app">
      <header className="header">
        <h1>端点迁移助手</h1>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={() => openModal('traffic-batch')}>
            + 新建切流批次
          </button>
          <button className="btn btn-secondary" onClick={() => handleExport('migration-report')}>
            导出迁移报告
          </button>
          <button className="btn btn-secondary" onClick={() => handleExport('exception-report')}>
            导出异常报告
          </button>
        </div>
      </header>

      <nav className="nav">
        {[
          { id: 'dashboard', label: '概览' },
          { id: 'exceptions', label: `异常队列 (${exceptions.length})` },
          { id: 'batches', label: '切流批次' },
          { id: 'endpoints', label: '端点管理' },
          { id: 'logs', label: '历史轨迹' }
        ].map(tab => (
          <button
            key={tab.id}
            className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="main">
        {activeTab === 'dashboard' && (
          <div className="dashboard">
            <div className="stats-grid">
              <StatsCard title="总端点数量" value={stats.totalEndpoints} color="#1890ff" />
              <StatsCard title="已迁移端点" value={stats.migratedEndpoints} color="#52c41a" />
              <StatsCard title="活跃切流批次" value={stats.activeBatches} color="#faad14" />
              <StatsCard title="异常数量" value={stats.exceptions} color="#ff4d4f" />
            </div>
            <div className="progress-card">
              <h3>迁移进度</h3>
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${stats.migrationProgress || 0}%` }}
                />
              </div>
              <span className="progress-text">{stats.migrationProgress || 0}%</span>
            </div>
            <div className="quick-actions">
              <button className="btn btn-primary" onClick={() => openModal('old-endpoint')}>
                + 登记旧端点
              </button>
              <button className="btn btn-primary" onClick={() => openModal('new-endpoint')}>
                + 登记新端点
              </button>
              <button className="btn btn-primary" onClick={() => openModal('calling-system')}>
                + 登记调用系统
              </button>
              <button className="btn btn-primary" onClick={() => openModal('compatibility-layer')}>
                + 配置兼容层
              </button>
            </div>
          </div>
        )}

        {activeTab === 'exceptions' && (
          <ExceptionQueue exceptions={exceptions} onRefresh={fetchAllData} />
        )}

        {activeTab === 'batches' && (
          <TrafficBatches 
            batches={batches} 
            onAction={handleBatchAction}
            callingSystems={callingSystems}
            newEndpoints={newEndpoints}
          />
        )}

        {activeTab === 'endpoints' && (
          <EndpointManager
            oldEndpoints={oldEndpoints}
            newEndpoints={newEndpoints}
            callingSystems={callingSystems}
            compatibilityLayers={compatibilityLayers}
            onOpenModal={openModal}
            onRefresh={fetchAllData}
          />
        )}

        {activeTab === 'logs' && (
          <RequestLogs logs={logs} />
        )}
      </main>

      {showModal && (
        <CreateModal
          type={modalType}
          onClose={() => setShowModal(false)}
          onCreate={handleCreate}
          callingSystems={callingSystems}
          oldEndpoints={oldEndpoints}
          newEndpoints={newEndpoints}
        />
      )}
    </div>
  )
}

export default App
