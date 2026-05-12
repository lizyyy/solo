import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { CourtSession, SessionStatus, CreateSessionRequest } from '../types'
import { api } from '../api'
import CreateSessionModal from '../components/CreateSessionModal'

interface SessionListProps {
  showToast: (message: string, type: 'success' | 'error') => void
}

const SessionList: React.FC<SessionListProps> = ({ showToast }) => {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<CourtSession[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [filters, setFilters] = useState({
    date: '',
    courtNumber: '',
    status: ''
  })

  const fetchSessions = async () => {
    try {
      const data = await api.getSessions()
      setSessions(data)
    } catch (error) {
      showToast('加载场次失败', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSessions()
  }, [])

  const handleCreateSession = async (data: CreateSessionRequest) => {
    try {
      await api.createSession(data)
      showToast('创建场次成功', 'success')
      setShowCreateModal(false)
      fetchSessions()
    } catch (error) {
      showToast('创建场次失败', 'error')
    }
  }

  const handleExport = () => {
    const csvContent = [
      ['日期', '场地', '时间', '状态', '已报名', '最大人数', '总费用'].join(','),
      ...filteredSessions.map(s => [
        s.date,
        s.courtNumber,
        `${s.startTime}-${s.endTime}`,
        getStatusText(s.status),
        getActivePlayers(s).length,
        s.maxPlayers,
        s.totalFee
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `场次列表_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    showToast('导出成功', 'success')
  }

  const filteredSessions = sessions.filter(s => {
    if (filters.date && s.date !== filters.date) return false
    if (filters.courtNumber && s.courtNumber.toString() !== filters.courtNumber) return false
    if (filters.status && s.status !== filters.status) return false
    return true
  })

  const getStatusText = (status: SessionStatus) => {
    const map: Record<SessionStatus, string> = {
      [SessionStatus.OPEN]: '报名中',
      [SessionStatus.FULL]: '已满',
      [SessionStatus.CANCELLED]: '已取消',
      [SessionStatus.COMPLETED]: '已完成'
    }
    return map[status]
  }

  const getStatusClass = (status: SessionStatus) => {
    const map: Record<SessionStatus, string> = {
      [SessionStatus.OPEN]: 'status-open',
      [SessionStatus.FULL]: 'status-full',
      [SessionStatus.CANCELLED]: 'status-cancelled',
      [SessionStatus.COMPLETED]: 'status-completed'
    }
    return map[status]
  }

  const getActivePlayers = (session: CourtSession) => {
    return session.players.filter(p => p.status !== 'cancelled' && p.status !== 'refunded')
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '60px' }}>加载中...</div>
  }

  return (
    <div>
      <div className="filters">
        <div className="filter-group">
          <label>日期</label>
          <input
            type="date"
            value={filters.date}
            onChange={e => setFilters(f => ({ ...f, date: e.target.value }))}
          />
        </div>
        <div className="filter-group">
          <label>场地号</label>
          <select
            value={filters.courtNumber}
            onChange={e => setFilters(f => ({ ...f, courtNumber: e.target.value }))}
          >
            <option value="">全部</option>
            {[...new Set(sessions.map(s => s.courtNumber))].sort().map(n => (
              <option key={n} value={n}>{n}号场</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label>状态</label>
          <select
            value={filters.status}
            onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
          >
            <option value="">全部</option>
            <option value={SessionStatus.OPEN}>报名中</option>
            <option value={SessionStatus.FULL}>已满</option>
            <option value={SessionStatus.CANCELLED}>已取消</option>
            <option value={SessionStatus.COMPLETED}>已完成</option>
          </select>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px' }}>
          <button className="btn btn-secondary" onClick={handleExport}>
            📊 导出数据
          </button>
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            ➕ 新开拼场
          </button>
        </div>
      </div>

      {filteredSessions.length === 0 ? (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M8 12h8M12 8v8" />
          </svg>
          <p>暂无场次记录，点击"新开拼场"创建第一个场次</p>
        </div>
      ) : (
        <div className="sessions-list">
          {filteredSessions.map(session => {
            const activePlayers = getActivePlayers(session)
            const progress = (activePlayers.length / session.maxPlayers) * 100

            return (
              <div
                key={session.id}
                className="session-card"
                onClick={() => navigate(`/session/${session.id}`)}
              >
                <div className="session-header">
                  <div className="session-info">
                    <h3>🏸 {session.courtNumber}号场地</h3>
                    <div className="session-meta">
                      <span className="meta-item">📅 {session.date}</span>
                      <span className="meta-item">⏰ {session.startTime} - {session.endTime}</span>
                      <span className="meta-item">👥 最低 {session.minPlayers} 人</span>
                    </div>
                  </div>
                  <span className={`status-badge ${getStatusClass(session.status)}`}>
                    {getStatusText(session.status)}
                  </span>
                </div>

                <div className="session-progress">
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="progress-text">
                    已报名 {activePlayers.length} / {session.maxPlayers} 人
                    {session.waitlist.length > 0 && ` (候补 ${session.waitlist.length} 人)`}
                  </div>
                </div>

                <div className="session-footer">
                  <span className="fee-info">💰 总费用 ¥{session.totalFee}</span>
                  <span style={{ color: '#666', fontSize: '13px' }}>
                    点击查看详情 →
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showCreateModal && (
        <CreateSessionModal
          onSubmit={handleCreateSession}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  )
}

export default SessionList
