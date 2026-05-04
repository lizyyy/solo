import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

function Dashboard({ onStatsUpdate }) {
  const [programs, setPrograms] = useState([])
  const [risks, setRisks] = useState([])
  const [stats, setStats] = useState(null)
  const [showNewProgram, setShowNewProgram] = useState(false)
  const [newProgram, setNewProgram] = useState({
    name: '',
    episode_number: '',
    title: '',
    status: 'draft'
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [programsRes, risksRes, statsRes] = await Promise.all([
        fetch('/api/programs'),
        fetch('/api/risks'),
        fetch('/api/stats')
      ])
      
      if (programsRes.ok) setPrograms(await programsRes.json())
      if (risksRes.ok) setRisks(await risksRes.json())
      if (statsRes.ok) setStats(await statsRes.json())
    } catch (error) {
      console.error('Failed to fetch data:', error)
    }
  }

  const handleCreateProgram = async (e) => {
    e.preventDefault()
    try {
      const response = await fetch('/api/programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newProgram,
          episode_number: newProgram.episode_number ? parseInt(newProgram.episode_number) : null
        })
      })
      
      if (response.ok) {
        setShowNewProgram(false)
        setNewProgram({ name: '', episode_number: '', title: '', status: 'draft' })
        fetchData()
        onStatsUpdate && onStatsUpdate()
      }
    } catch (error) {
      console.error('Failed to create program:', error)
    }
  }

  const handleRunScan = async () => {
    try {
      const response = await fetch('/api/import/scan', { method: 'POST' })
      if (response.ok) {
        const data = await response.json()
        alert(`扫描完成！发现：过期${data.results.expired}，即将过期${data.results.expiring}，未授权${data.results.unauthorized}，广告超时${data.results.adDuration}，重复声明${data.results.duplicates}`)
        fetchData()
        onStatsUpdate && onStatsUpdate()
      }
    } catch (error) {
      console.error('Failed to run scan:', error)
    }
  }

  const getRiskTypeLabel = (type) => {
    const labels = {
      'expired_music': '音乐过期',
      'expiring_soon': '即将过期',
      'no_authorization': '缺少授权',
      'ad_too_long': '广告超时',
      'duplicate_claim': '重复声明'
    }
    return labels[type] || type
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">节目数</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats?.programs || 0}</p>
            </div>
            <div className="text-3xl">🎙️</div>
          </div>
        </div>
        
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">待处理风险</p>
              <p className="text-2xl font-bold text-danger-600 mt-1">{stats?.risks?.pending || 0}</p>
            </div>
            <div className="text-3xl">⚠️</div>
          </div>
        </div>
        
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">处理中</p>
              <p className="text-2xl font-bold text-primary-600 mt-1">{stats?.risks?.reviewing || 0}</p>
            </div>
            <div className="text-3xl">🔍</div>
          </div>
        </div>
        
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">已解决</p>
              <p className="text-2xl font-bold text-success-600 mt-1">{stats?.risks?.resolved || 0}</p>
            </div>
            <div className="text-3xl">✅</div>
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        <button
          onClick={() => setShowNewProgram(true)}
          className="btn-primary"
        >
          ➕ 新建节目
        </button>
        <button
          onClick={handleRunScan}
          className="btn-secondary"
        >
          🔍 执行风险扫描
        </button>
      </div>

      {showNewProgram && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">新建节目</h3>
          <form onSubmit={handleCreateProgram} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  节目名称 *
                </label>
                <input
                  type="text"
                  className="input"
                  value={newProgram.name}
                  onChange={(e) => setNewProgram({ ...newProgram, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  期数
                </label>
                <input
                  type="number"
                  className="input"
                  value={newProgram.episode_number}
                  onChange={(e) => setNewProgram({ ...newProgram, episode_number: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                标题
              </label>
              <input
                type="text"
                className="input"
                value={newProgram.title}
                onChange={(e) => setNewProgram({ ...newProgram, title: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary">
                创建
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowNewProgram(false)}
              >
                取消
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">📋 节目列表</h3>
          {programs.length === 0 ? (
            <p className="text-gray-500 text-center py-8">暂无节目，点击上方按钮创建</p>
          ) : (
            <div className="space-y-3">
              {programs.slice(0, 5).map((program) => (
                <Link
                  key={program.id}
                  to={`/programs/${program.id}`}
                  className="block p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900">
                        {program.name}
                        {program.episode_number && ` #${program.episode_number}`}
                      </h4>
                      {program.title && (
                        <p className="text-sm text-gray-500 mt-1">{program.title}</p>
                      )}
                    </div>
                    <span className={`badge badge-${program.status === 'draft' ? 'pending' : program.status === 'reviewing' ? 'reviewing' : 'resolved'}`}>
                      {program.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold mb-4">⚠️ 最近风险</h3>
          {risks.filter(r => r.status === 'pending' || r.status === 'reviewing').length === 0 ? (
            <p className="text-gray-500 text-center py-8">暂无待处理风险</p>
          ) : (
            <div className="space-y-3">
              {risks
                .filter(r => r.status === 'pending' || r.status === 'reviewing')
                .slice(0, 5)
                .map((risk) => (
                  <Link
                    key={risk.id}
                    to={`/risks`}
                    className="block p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`badge badge-${risk.severity}`}>
                            {risk.severity === 'high' ? '高' : risk.severity === 'medium' ? '中' : '低'}
                          </span>
                          <span className="text-sm text-gray-500">
                            {getRiskTypeLabel(risk.risk_type)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700">{risk.description}</p>
                      </div>
                      <span className={`badge badge-${risk.status} ml-2`}>
                        {risk.status === 'pending' ? '待处理' : risk.status === 'reviewing' ? '处理中' : risk.status}
                      </span>
                    </div>
                  </Link>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Dashboard
