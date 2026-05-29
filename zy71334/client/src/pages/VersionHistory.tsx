import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, GitCompare, Clock, User, AlertTriangle, ChevronDown, ChevronUp, CheckCircle, XCircle } from 'lucide-react'
import { problemApi } from '../services/api'
import { ProblemWithDetails, ProblemVersion, VersionDiff } from '../types'
import { formatDateTime, getStatusBgClass, getAnomalyTypeColor } from '../utils/format'

export default function VersionHistory() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [problem, setProblem] = useState<ProblemWithDetails | null>(null)
  const [versions, setVersions] = useState<ProblemVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedVersions, setExpandedVersions] = useState<Set<number>>(new Set())
  const [compareMode, setCompareMode] = useState(false)
  const [selectedV1, setSelectedV1] = useState<number | null>(null)
  const [selectedV2, setSelectedV2] = useState<number | null>(null)
  const [diffResult, setDiffResult] = useState<VersionDiff[] | null>(null)
  const [diffLoading, setDiffLoading] = useState(false)

  useEffect(() => {
    if (id) loadData()
  }, [id])

  const loadData = async () => {
    if (!id) return
    setLoading(true)
    try {
      const [problemData, versionsData] = await Promise.all([
        problemApi.getProblemById(id),
        problemApi.getVersions(id),
      ])
      setProblem(problemData)
      setVersions(versionsData)
      setExpandedVersions(new Set([versionsData[0]?.version]))
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleVersion = (version: number) => {
    const newExpanded = new Set(expandedVersions)
    if (newExpanded.has(version)) {
      newExpanded.delete(version)
    } else {
      newExpanded.add(version)
    }
    setExpandedVersions(newExpanded)
  }

  const handleCompare = async () => {
    if (!id || selectedV1 === null || selectedV2 === null) return
    setDiffLoading(true)
    try {
      const diff = await problemApi.compareVersions(id, selectedV1, selectedV2)
      setDiffResult(diff)
    } catch (error) {
      console.error('Failed to compare versions:', error)
    } finally {
      setDiffLoading(false)
    }
  }

  const selectForCompare = (version: number) => {
    if (selectedV1 === null) {
      setSelectedV1(version)
    } else if (selectedV2 === null && version !== selectedV1) {
      setSelectedV2(version)
    }
  }

  const clearCompare = () => {
    setSelectedV1(null)
    setSelectedV2(null)
    setDiffResult(null)
  }

  const fieldLabels: Record<string, string> = {
    musicianName: '乐手姓名',
    channel: '监听通道',
    description: '问题描述',
    tuningAction: '调音动作',
    tuningParams: '调音参数',
  }

  const renderDiffValue = (value: unknown, isOld: boolean) => {
    if (value === null || value === undefined) return <span className="text-slate-500">（空）</span>
    if (typeof value === 'object') return JSON.stringify(value, null, 2)
    return String(value)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-stage-blue rounded w-48" />
          <div className="h-12 bg-stage-dark rounded" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-32 bg-stage-dark rounded" />
          ))}
        </div>
      </div>
    )
  }

  if (!problem) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">问题不存在</p>
        <Link to="/" className="text-accent-amber text-sm mt-2 inline-block">返回工作台</Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-stage-blue transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="font-display text-xl font-bold text-white">
                {problem.musicianName} - 版本历史
              </h2>
              <span className={`px-2 py-1 rounded text-xs border ${getStatusBgClass(problem.status)}`}>
                {problem.status === 'pending' && '待处理'}
                {problem.status === 'in_progress' && '处理中'}
                {problem.status === 'resolved' && '已解决'}
                {problem.status === 'confirmed' && '已确认'}
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              通道 {problem.channel} · 共 {versions.length} 个版本
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setCompareMode(!compareMode); clearCompare() }}
            className={`flex items-center gap-2 px-4 py-2 rounded text-sm transition-all ${
              compareMode
                ? 'bg-accent-amber text-stage-darker'
                : 'btn-secondary'
            }`}
          >
            <GitCompare className="w-4 h-4" />
            {compareMode ? '退出对比' : '版本对比'}
          </button>
        </div>
      </div>

      {compareMode && (
        <div className="card bg-accent-amber/5 border-accent-amber/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <span className="label">版本 A</span>
                <select
                  value={selectedV1 ?? ''}
                  onChange={(e) => setSelectedV1(e.target.value ? parseInt(e.target.value) : null)}
                  className="input w-32"
                >
                  <option value="">选择版本</option>
                  {versions.map(v => (
                    <option key={v.version} value={v.version}>V{v.version}</option>
                  ))}
                </select>
              </div>
              <span className="text-slate-400 mt-6">→</span>
              <div>
                <span className="label">版本 B</span>
                <select
                  value={selectedV2 ?? ''}
                  onChange={(e) => setSelectedV2(e.target.value ? parseInt(e.target.value) : null)}
                  className="input w-32"
                >
                  <option value="">选择版本</option>
                  {versions.filter(v => v.version !== selectedV1).map(v => (
                    <option key={v.version} value={v.version}>V{v.version}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleCompare}
                disabled={selectedV1 === null || selectedV2 === null || diffLoading}
                className="btn-primary mt-6"
              >
                {diffLoading ? '对比中...' : '开始对比'}
              </button>
            </div>
            <button onClick={clearCompare} className="text-slate-400 hover:text-white text-sm">
              清除选择
            </button>
          </div>
        </div>
      )}

      {diffResult && (
        <div className="card">
          <h3 className="font-display text-sm font-bold text-white mb-4 flex items-center gap-2">
            <GitCompare className="w-4 h-4 text-accent-amber" />
            版本对比结果 · V{selectedV1} → V{selectedV2}
          </h3>
          <div className="space-y-3">
            {diffResult.map((diff, idx) => (
              <div key={idx} className={`p-4 rounded-lg ${diff.changed ? 'bg-stage-darker' : 'bg-stage-dark/30'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-white">{fieldLabels[diff.field] || diff.field}</span>
                  {diff.changed ? (
                    <span className="text-xs px-2 py-0.5 rounded bg-accent-amber/10 text-accent-amber border border-accent-amber/30">
                      已变更
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-500/10 text-slate-400 border border-slate-500/30">
                      无变化
                    </span>
                  )}
                </div>
                {diff.changed && (
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="space-y-1">
                      <span className="text-xs text-accent-red flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> 旧值
                      </span>
                      <pre className="bg-accent-red/10 p-2 rounded text-slate-300 font-mono text-xs whitespace-pre-wrap">
                        {renderDiffValue(diff.oldValue, true)}
                      </pre>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-accent-green flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> 新值
                      </span>
                      <pre className="bg-accent-green/10 p-2 rounded text-slate-300 font-mono text-xs whitespace-pre-wrap">
                        {renderDiffValue(diff.newValue, false)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="relative">
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-stage-border" />

        {versions.map((version, index) => (
          <div key={version.id} className="relative pl-16 pb-6">
            <div className={`absolute left-4 w-5 h-5 rounded-full border-2 ${
              index === 0
                ? 'bg-accent-amber border-accent-amber'
                : 'bg-stage-darker border-stage-blue'
            }`}>
              {index === 0 && (
                <div className="absolute inset-0.5 bg-white rounded-full" />
              )}
            </div>

            <div
              className={`card cursor-pointer transition-all ${
                compareMode && (selectedV1 === version.version || selectedV2 === version.version)
                  ? 'border-accent-amber/50 bg-accent-amber/5'
                  : ''
              }`}
              onClick={() => compareMode ? selectForCompare(version.version) : toggleVersion(version.version)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded font-mono font-bold ${
                    index === 0
                      ? 'bg-accent-amber text-stage-darker'
                      : 'bg-stage-blue text-slate-300'
                  }`}>
                    V{version.version}
                  </span>
                  {version.parentVersion && (
                    <span className="text-xs text-slate-500">
                      父版本: V{version.parentVersion}
                    </span>
                  )}
                  {index === 0 && (
                    <span className="text-xs px-2 py-0.5 rounded bg-accent-green/10 text-accent-green border border-accent-green/30">
                      当前版本
                    </span>
                  )}
                  {version.anomalyDetected && (
                    <span className={`text-xs px-2 py-0.5 rounded border ${getAnomalyTypeColor(version.anomalyDetected.type)}`}>
                      <AlertTriangle className="w-3 h-3 inline mr-1" />
                      异常检测
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {version.operatorName}
                  </span>
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDateTime(version.createdAt)}
                  </span>
                  {compareMode ? (
                    <div className={`w-4 h-4 rounded border-2 ${
                      selectedV1 === version.version
                        ? 'bg-accent-amber border-accent-amber'
                        : selectedV2 === version.version
                        ? 'bg-accent-green border-accent-green'
                        : 'border-slate-500'
                    }`} />
                  ) : (
                    expandedVersions.has(version.version) ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )
                  )}
                </div>
              </div>

              {expandedVersions.has(version.version) && (
                <div className="mt-4 pt-4 border-t border-stage-border space-y-4">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="label">乐手</span>
                      <p className="text-white">{version.musicianName}</p>
                    </div>
                    <div>
                      <span className="label">监听通道</span>
                      <p className="text-white font-mono">CH {version.channel}</p>
                    </div>
                    <div>
                      <span className="label">操作人</span>
                      <p className="text-white">{version.operatorName}</p>
                    </div>
                  </div>

                  <div>
                    <span className="label">问题描述</span>
                    <p className="text-white text-sm">{version.description}</p>
                  </div>

                  {version.tuningAction && (
                    <div>
                      <span className="label">调音动作</span>
                      <p className="text-white text-sm">{version.tuningAction}</p>
                    </div>
                  )}

                  {version.tuningParams && (
                    <div>
                      <span className="label">调音参数</span>
                      <pre className="text-xs text-slate-300 bg-stage-darker p-3 rounded font-mono overflow-x-auto">
                        {JSON.stringify(version.tuningParams, null, 2)}
                      </pre>
                    </div>
                  )}

                  {version.changeReason && (
                    <div>
                      <span className="label">修改原因</span>
                      <p className="text-white text-sm">{version.changeReason}</p>
                    </div>
                  )}

                  {version.anomalyDetected && (
                    <div className="bg-accent-amber/5 border border-accent-amber/30 rounded-lg p-4">
                      <h4 className="text-sm font-bold text-accent-amber mb-2 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        异常信息
                      </h4>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="label">异常类型</span>
                          <p className="text-white">{
                            version.anomalyDetected.type === 'channel_invalid' ? '通道错误' :
                            version.anomalyDetected.type === 'duplicate' ? '重复问题' : '覆盖风险'
                          }</p>
                        </div>
                        <div className="col-span-2">
                          <span className="label">原因</span>
                          <p className="text-white">{version.anomalyDetected.reason}</p>
                        </div>
                        <div className="col-span-3">
                          <span className="label">影响范围</span>
                          <p className="text-slate-300">{version.anomalyDetected.impact}</p>
                        </div>
                        <div className="col-span-3">
                          <span className="label">下一步动作</span>
                          <p className="text-accent-green">{version.anomalyDetected.nextAction}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
