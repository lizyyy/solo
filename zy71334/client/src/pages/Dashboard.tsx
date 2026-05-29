import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Filter, AlertTriangle, Clock, User, Mic, ChevronRight } from 'lucide-react'
import { problemApi, anomalyApi } from '../services/api'
import { Problem, AnomalyRecord, CreateProblemRequest, sectionOptions } from '../types'
import { formatDateTime, timeAgo, getStatusBgClass, getAnomalyTypeColor } from '../utils/format'
import ChannelStatusPanel from '../components/ChannelStatusPanel'
import AnomalyCard from '../components/AnomalyCard'

export default function Dashboard() {
  const [problems, setProblems] = useState<Problem[]>([])
  const [anomalies, setAnomalies] = useState<AnomalyRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedChannel, setSelectedChannel] = useState<number | null>(null)
  const [filters, setFilters] = useState({ status: '', channel: '', musician: '' })
  const [newProblem, setNewProblem] = useState<CreateProblemRequest>({
    musicianName: '',
    section: '',
    channel: 1,
    description: '',
    operatorName: '李音响师',
  })

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    loadProblems()
  }, [filters])

  const loadData = async () => {
    setLoading(true)
    try {
      await Promise.all([loadProblems(), loadAnomalies()])
    } finally {
      setLoading(false)
    }
  }

  const loadProblems = async () => {
    const parsedFilters = {
      status: filters.status || undefined,
      channel: filters.channel ? parseInt(filters.channel) : undefined,
      musician: filters.musician || undefined,
    }
    const data = await problemApi.getProblems(parsedFilters)
    setProblems(data)
  }

  const loadAnomalies = async () => {
    const data = await anomalyApi.getAll()
    setAnomalies(data)
  }

  const handleCreateProblem = async () => {
    if (!newProblem.musicianName || !newProblem.section || !newProblem.description) return

    try {
      await problemApi.createProblem(newProblem)
      setShowCreateModal(false)
      setNewProblem({
        musicianName: '',
        section: '',
        channel: 1,
        description: '',
        operatorName: '李音响师',
      })
      loadData()
    } catch (error) {
      console.error('Failed to create problem:', error)
    }
  }

  const handleChannelClick = (channel: number) => {
    setSelectedChannel(channel === selectedChannel ? null : channel)
    setFilters(f => ({ ...f, channel: channel === selectedChannel ? '' : channel.toString() }))
  }

  const stats = {
    total: problems.length,
    pending: problems.filter(p => p.status === 'pending').length,
    inProgress: problems.filter(p => p.status === 'in_progress').length,
    resolved: problems.filter(p => p.status === 'resolved' || p.status === 'confirmed').length,
    anomalies: anomalies.length,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-white">问题单工作台</h2>
          <p className="text-slate-400 text-sm mt-1">管理彩排现场的返听问题，全程可追溯</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          快速录入问题
        </button>
      </div>

      <div className="grid grid-cols-5 gap-4">
        <div className="card">
          <div className="text-3xl font-bold text-white font-display">{stats.total}</div>
          <div className="text-xs text-slate-400 mt-1">问题总数</div>
        </div>
        <div className="card">
          <div className="text-3xl font-bold text-accent-amber font-display">{stats.pending}</div>
          <div className="text-xs text-slate-400 mt-1">待处理</div>
        </div>
        <div className="card">
          <div className="text-3xl font-bold text-accent-yellow font-display">{stats.inProgress}</div>
          <div className="text-xs text-slate-400 mt-1">处理中</div>
        </div>
        <div className="card">
          <div className="text-3xl font-bold text-accent-green font-display">{stats.resolved}</div>
          <div className="text-xs text-slate-400 mt-1">已解决</div>
        </div>
        <div className="card">
          <div className="text-3xl font-bold text-accent-red font-display">{stats.anomalies}</div>
          <div className="text-xs text-slate-400 mt-1">异常记录</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1 space-y-4">
          <ChannelStatusPanel onChannelClick={handleChannelClick} selectedChannel={selectedChannel} />

          {anomalies.length > 0 && (
            <div className="card">
              <h3 className="font-display text-sm font-bold text-white mb-4 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-accent-amber" />
                最新异常
                <span className="ml-auto text-xs text-accent-red">{anomalies.length} 条</span>
              </h3>
              <div className="space-y-3 max-h-80 overflow-y-auto scrollbar-thin">
                {anomalies.slice(0, 3).map((anomaly) => (
                  <AnomalyCard key={anomaly.id} anomaly={anomaly} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="col-span-2 space-y-4">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-sm font-bold text-white flex items-center gap-2">
                <Search className="w-4 h-4 text-slate-400" />
                问题列表
              </h3>
              <div className="flex items-center gap-2">
                <select
                  value={filters.status}
                  onChange={(e) => setFilters(f => ({ ...f, status: e.target.value }))}
                  className="input text-xs py-1.5 px-2 w-32"
                >
                  <option value="">全部状态</option>
                  <option value="pending">待处理</option>
                  <option value="in_progress">处理中</option>
                  <option value="resolved">已解决</option>
                  <option value="confirmed">已确认</option>
                </select>
                <input
                  type="text"
                  placeholder="搜索乐手姓名..."
                  value={filters.musician}
                  onChange={(e) => setFilters(f => ({ ...f, musician: e.target.value }))}
                  className="input text-xs py-1.5 px-2 w-40"
                />
              </div>
            </div>

            {loading ? (
              <div className="animate-pulse space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-16 bg-stage-blue rounded" />
                ))}
              </div>
            ) : problems.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Mic className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>暂无问题记录</p>
                <p className="text-xs mt-1">点击右上角按钮录入第一个问题</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto scrollbar-thin">
                {problems.map((problem, index) => {
                  const hasAnomaly = anomalies.some(a => a.problemId === problem.id)
                  return (
                    <Link
                      key={problem.id}
                      to={`/problem/${problem.id}`}
                      className={`block p-4 rounded-lg border transition-all duration-200 hover:border-accent-amber/50 ${
                        index % 2 === 0 ? 'bg-stage-dark' : 'bg-stage-dark/50'
                      } ${hasAnomaly ? 'border-accent-amber/30' : 'border-stage-border'}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="text-center">
                            <div className="w-10 h-10 rounded-lg bg-stage-blue flex items-center justify-center">
                              <span className="text-lg font-bold text-accent-amber font-mono">{problem.channel}</span>
                            </div>
                            <span className="text-[10px] text-slate-500">CH</span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-white font-medium">{problem.musicianName}</span>
                              <span className="text-xs text-slate-500">· {problem.section}</span>
                              <span className={`px-2 py-0.5 rounded text-xs border ${getStatusBgClass(problem.status)}`}>
                                {problem.status === 'pending' && '待处理'}
                                {problem.status === 'in_progress' && '处理中'}
                                {problem.status === 'resolved' && '已解决'}
                                {problem.status === 'confirmed' && '已确认'}
                              </span>
                              {hasAnomaly && (
                                <span className="px-2 py-0.5 rounded text-xs bg-accent-red/10 text-accent-red border border-accent-red/30">
                                  <AlertTriangle className="w-3 h-3 inline mr-1" />
                                  异常
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-slate-300 line-clamp-1">{problem.description}</p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {timeAgo(problem.discoveredAt)}
                              </span>
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                V{problem.currentVersion}
                              </span>
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-500" />
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-lg">
            <h3 className="font-display text-lg font-bold text-white mb-4">快速录入问题</h3>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">乐手姓名</label>
                  <input
                    type="text"
                    value={newProblem.musicianName}
                    onChange={(e) => setNewProblem(p => ({ ...p, musicianName: e.target.value }))}
                    placeholder="如：张伟"
                    className="input"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="label">声部</label>
                  <select
                    value={newProblem.section}
                    onChange={(e) => setNewProblem(p => ({ ...p, section: e.target.value }))}
                    className="input"
                  >
                    <option value="">请选择声部</option>
                    {sectionOptions.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">监听通道 (1-32)</label>
                  <input
                    type="number"
                    min="1"
                    max="32"
                    value={newProblem.channel}
                    onChange={(e) => setNewProblem(p => ({ ...p, channel: parseInt(e.target.value) || 1 }))}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">操作人</label>
                  <input
                    type="text"
                    value={newProblem.operatorName}
                    onChange={(e) => setNewProblem(p => ({ ...p, operatorName: e.target.value }))}
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label className="label">问题描述</label>
                <textarea
                  value={newProblem.description}
                  onChange={(e) => setNewProblem(p => ({ ...p, description: e.target.value }))}
                  placeholder="请详细描述返听问题，如：人声高频刺耳，齿音太重"
                  className="input resize-none h-24"
                />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-stage-border">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary"
                >
                  取消
                </button>
                <button
                  onClick={handleCreateProblem}
                  disabled={!newProblem.musicianName || !newProblem.section || !newProblem.description}
                  className="btn-primary"
                >
                  创建问题单
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
