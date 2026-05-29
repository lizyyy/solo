import { useState, useEffect, useRef } from 'react'
import { Download, FileText, Calendar, Filter, CheckCircle, AlertTriangle, Clock, User, Mic } from 'lucide-react'
import { reportApi, problemApi } from '../services/api'
import { ProblemWithDetails, ChannelStatus } from '../types'
import { formatDateTime, getStatusBgClass, timeAgo } from '../utils/format'
import { exportToPDF } from '../utils/pdfExport'
import ChannelStatusPanel from '../components/ChannelStatusPanel'
import AnomalyCard from '../components/AnomalyCard'

export default function ReportExport() {
  const [problems, setProblems] = useState<ProblemWithDetails[]>([])
  const [channels, setChannels] = useState<ChannelStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [selectedProblem, setSelectedProblem] = useState<ProblemWithDetails | null>(null)
  const [filters, setFilters] = useState({ status: '', startDate: '', endDate: '' })
  const reportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadData()
  }, [filters])

  const loadData = async () => {
    setLoading(true)
    try {
      const parsedFilters: { rehearsalId?: string; startDate?: string; endDate?: string } = {}
      if (filters.startDate) parsedFilters.startDate = filters.startDate
      if (filters.endDate) parsedFilters.endDate = filters.endDate

      const data = await reportApi.getReportData(parsedFilters)
      setProblems(data)
    } catch (error) {
      console.error('Failed to load report data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleExportPDF = async (problem?: ProblemWithDetails) => {
    setExporting(true)
    try {
      const exportData = problem ? [problem] : problems
      await exportToPDF(exportData, problem?.musicianName)
    } catch (error) {
      console.error('Failed to export PDF:', error)
    } finally {
      setExporting(false)
    }
  }

  const handleChannelClick = (channel: number) => {
    const problem = problems.find(p => p.channel === channel)
    if (problem) {
      setSelectedProblem(problem)
    }
  }

  const filteredProblems = problems.filter(p => {
    if (filters.status && p.status !== filters.status) return false
    return true
  })

  const stats = {
    total: problems.length,
    pending: problems.filter(p => p.status === 'pending').length,
    inProgress: problems.filter(p => p.status === 'in_progress').length,
    resolved: problems.filter(p => p.status === 'resolved' || p.status === 'confirmed').length,
    confirmed: problems.filter(p => p.status === 'confirmed').length,
    anomalies: problems.reduce((acc, p) => acc + p.anomalies.length, 0),
    withVersions: problems.filter(p => p.versions.length > 1).length,
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-stage-blue rounded w-48" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-stage-dark rounded" />
            ))}
          </div>
          <div className="h-64 bg-stage-dark rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-white">返听报告导出</h2>
          <p className="text-slate-400 text-sm mt-1">生成完整的彩排返听问题报告，支持 PDF 导出</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExportPDF()}
            disabled={exporting || problems.length === 0}
            className="btn-primary flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            {exporting ? '导出中...' : '导出全部报告'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-bold text-white font-display">{stats.total}</div>
              <div className="text-xs text-slate-400 mt-1">问题总数</div>
            </div>
            <Mic className="w-8 h-8 text-slate-500" />
          </div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-bold text-accent-amber font-display">{stats.pending}</div>
              <div className="text-xs text-slate-400 mt-1">待处理</div>
            </div>
            <Clock className="w-8 h-8 text-slate-500" />
          </div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-bold text-accent-green font-display">{stats.resolved}</div>
              <div className="text-xs text-slate-400 mt-1">已解决</div>
            </div>
            <CheckCircle className="w-8 h-8 text-slate-500" />
          </div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-bold text-accent-red font-display">{stats.anomalies}</div>
              <div className="text-xs text-slate-400 mt-1">异常记录</div>
            </div>
            <AlertTriangle className="w-8 h-8 text-slate-500" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1 space-y-4">
          <div className="card">
            <h3 className="font-display text-sm font-bold text-white mb-4 flex items-center gap-2">
              <Filter className="w-4 h-4 text-accent-amber" />
              筛选条件
            </h3>
            <div className="space-y-4">
              <div>
                <label className="label">问题状态</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters(f => ({ ...f, status: e.target.value }))}
                  className="input"
                >
                  <option value="">全部状态</option>
                  <option value="pending">待处理</option>
                  <option value="in_progress">处理中</option>
                  <option value="resolved">已解决</option>
                  <option value="confirmed">已确认</option>
                </select>
              </div>
              <div>
                <label className="label">开始日期</label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters(f => ({ ...f, startDate: e.target.value }))}
                  className="input"
                />
              </div>
              <div>
                <label className="label">结束日期</label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters(f => ({ ...f, endDate: e.target.value }))}
                  className="input"
                />
              </div>
              <button
                onClick={loadData}
                className="btn-secondary w-full"
              >
                应用筛选
              </button>
            </div>
          </div>

          <ChannelStatusPanel onChannelClick={handleChannelClick} />

          <div className="card">
            <h3 className="font-display text-sm font-bold text-white mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-accent-amber" />
              统计信息
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">已确认问题</span>
                <span className="text-accent-green font-medium">{stats.confirmed}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">多版本记录</span>
                <span className="text-white font-medium">{stats.withVersions}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">完整率</span>
                <span className="text-white font-medium">
                  {stats.total > 0 ? Math.round((stats.confirmed / stats.total) * 100) : 0}%
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-2 space-y-4">
          {selectedProblem && (
            <div className="card border-accent-amber/30 bg-accent-amber/5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display text-sm font-bold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-accent-amber" />
                  选中问题预览
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleExportPDF(selectedProblem)}
                    disabled={exporting}
                    className="btn-primary text-xs py-1.5 px-3"
                  >
                    <Download className="w-3 h-3 inline mr-1" />
                    导出此问题
                  </button>
                  <button
                    onClick={() => setSelectedProblem(null)}
                    className="text-slate-400 hover:text-white text-sm"
                  >
                    清除选择
                  </button>
                </div>
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="label">乐手</span>
                    <p className="text-white">{selectedProblem.musicianName}</p>
                  </div>
                  <div>
                    <span className="label">声部</span>
                    <p className="text-white">{selectedProblem.section}</p>
                  </div>
                  <div>
                    <span className="label">通道</span>
                    <p className="text-white font-mono">CH {selectedProblem.channel}</p>
                  </div>
                  <div>
                    <span className="label">版本</span>
                    <p className="text-white font-mono">V{selectedProblem.currentVersion}</p>
                  </div>
                </div>
                <div>
                  <span className="label">问题描述</span>
                  <p className="text-white text-sm">{selectedProblem.description}</p>
                </div>
                {selectedProblem.anomalies.length > 0 && (
                  <div className="space-y-2">
                    <span className="label">异常记录</span>
                    {selectedProblem.anomalies.map(a => (
                      <AnomalyCard key={a.id} anomaly={a} showLink={false} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-sm font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-400" />
                问题列表 ({filteredProblems.length})
              </h3>
              <span className="text-xs text-slate-400">
                点击条目查看详情
              </span>
            </div>

            {filteredProblems.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>暂无符合条件的问题记录</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[700px] overflow-y-auto scrollbar-thin">
                {filteredProblems.map((problem) => (
                  <div
                    key={problem.id}
                    onClick={() => setSelectedProblem(problem)}
                    className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 hover:border-accent-amber/50 ${
                      selectedProblem?.id === problem.id
                        ? 'border-accent-amber/50 bg-accent-amber/5'
                        : 'border-stage-border hover:bg-stage-dark/50'
                    }`}
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
                            {problem.anomalies.length > 0 && (
                              <span className="px-2 py-0.5 rounded text-xs bg-accent-red/10 text-accent-red border border-accent-red/30">
                                <AlertTriangle className="w-3 h-3 inline mr-1" />
                                {problem.anomalies.length}
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
                              V{problem.currentVersion} · {problem.versions.length} 版
                            </span>
                            {problem.confirmation && (
                              <span className="flex items-center gap-1 text-accent-green">
                                <CheckCircle className="w-3 h-3" />
                                已签收
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleExportPDF(problem)
                        }}
                        disabled={exporting}
                        className="p-2 rounded hover:bg-stage-blue text-slate-400 hover:text-white transition-colors"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div ref={reportRef} className="hidden">
        {problems.map((problem) => (
          <div key={problem.id} className="page-break">
            <h2>{problem.musicianName} - 通道 {problem.channel}</h2>
            <p>状态: {problem.status}</p>
            <p>问题: {problem.description}</p>
            <p>发现时间: {formatDateTime(problem.discoveredAt)}</p>
            <h3>版本历史</h3>
            {problem.versions.map((v) => (
              <div key={v.id}>
                <p>V{v.version} - {formatDateTime(v.createdAt)}</p>
                <p>操作人: {v.operatorName}</p>
                {v.tuningAction && <p>调音动作: {v.tuningAction}</p>}
              </div>
            ))}
            {problem.confirmation && (
              <div>
                <h3>签收确认</h3>
                <p>乐手: {problem.confirmation.musicianSigned ? '已签收' : '未签收'}</p>
                <p>工程师: {problem.confirmation.engineerSigned ? '已签收' : '未签收'}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
