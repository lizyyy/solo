import { useState, useEffect } from 'react'
import {
  AlertTriangle,
  Download,
  CheckCircle,
  Clock,
  XCircle,
  Thermometer,
  Navigation,
  AlertCircle,
  Loader2,
  X,
  ChevronRight,
  User,
  Calendar,
  Search,
  RefreshCw,
  FileSpreadsheet,
  History,
} from 'lucide-react'
import type {
  AnomalyRecord,
  AnomalySummary,
  DirectionStatus,
  RecordStatus,
  AuditLog,
  ApiError,
  AnomalyRecordsResponse,
} from '@/types'
import { cn } from '@/lib/utils'

interface RollbackModalState {
  open: boolean
  record: AnomalyRecord | null
  reason: string
  submitting: boolean
}

export default function AnomaliesPage() {
  const [summary, setSummary] = useState<AnomalySummary | null>(null)
  const [records, setRecords] = useState<AnomalyRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [rollbackLogs, setRollbackLogs] = useState<AuditLog[]>([])
  const [rollbackLogsLoading, setRollbackLogsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const [rollbackModal, setRollbackModal] = useState<RollbackModalState>({
    open: false,
    record: null,
    reason: '',
    submitting: false,
  })

  useEffect(() => {
    fetchSummary()
    fetchRecords()
    fetchRollbackLogs()
  }, [])

  const fetchSummary = async () => {
    setSummaryLoading(true)
    try {
      const response = await fetch('/api/anomalies/summary')
      const data = await response.json() as AnomalySummary | ApiError

      if (!response.ok) {
        const err = data as ApiError
        setErrorMsg(`摘要加载失败: ${err.error || '请刷新重试'}`)
        return
      }

      setSummary(data as AnomalySummary)
    } catch {
      setErrorMsg('网络错误，加载摘要失败，请检查连接后重试')
    } finally {
      setSummaryLoading(false)
    }
  }

  const fetchRecords = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/anomalies/records?includeAll=1&pageSize=100')
      const data = await response.json() as AnomalyRecordsResponse | ApiError | { success: boolean; total: number; data: AnomalyRecord[] }

      if (!response.ok) {
        const err = data as ApiError
        setErrorMsg(`记录加载失败: ${err.error || '请刷新重试'}`)
        return
      }

      let list: AnomalyRecord[] = []
      const respAny = data as any
      if (Array.isArray(respAny)) {
        list = respAny
      } else if (Array.isArray(respAny.data)) {
        list = respAny.data
      }
      list = list.map(r => ({ ...r, triggerReason: r.triggerReason || r.anomalyReason || '' }))
      setRecords(list)
    } catch {
      setErrorMsg('网络错误，加载记录失败，请检查连接后重试')
    } finally {
      setLoading(false)
    }
  }

  const fetchRollbackLogs = async () => {
    setRollbackLogsLoading(true)
    try {
      const response = await fetch('/api/calibration/records?pageSize=200')
      if (!response.ok) {
        setRollbackLogs([])
        return
      }
      const data = await response.json() as { data: { id: number }[] }

      const allLogs: AuditLog[] = []
      const recordIds = (data.data || []).map(r => r.id)

      for (const id of recordIds.slice(0, 50)) {
        try {
          const logRes = await fetch(`/api/calibration/records/${id}/audit`)
          if (logRes.ok) {
            const logData = await logRes.json() as { data: AuditLog[] }
            for (const log of logData.data || []) {
              if (log.fieldName === 'direction' && log.role === 'lab_teacher') {
                allLogs.push(log)
              }
            }
          }
        } catch {
          // skip individual errors
        }
      }

      allLogs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      setRollbackLogs(allLogs.slice(0, 20))
    } catch {
      setRollbackLogs([])
    } finally {
      setRollbackLogsLoading(false)
    }
  }

  const refreshAll = () => {
    setErrorMsg(null)
    fetchSummary()
    fetchRecords()
    fetchRollbackLogs()
  }

  const handleConfirm = async (record: AnomalyRecord) => {
    try {
      const response = await fetch(`/api/anomalies/records/${record.id}/confirm`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: '实验老师确认数据无误',
          changedBy: '实验老师',
          role: 'lab_teacher',
        }),
      })

      const data = await response.json() as { success: boolean; error?: string }

      if (!response.ok || !data.success) {
        setErrorMsg(data.error || '确认失败，请重试')
        return
      }

      setRecords(prev => prev.map(r =>
        r.id === record.id ? { ...r, status: 'confirmed' as RecordStatus } : r
      ))
      fetchSummary()
    } catch {
      setErrorMsg('网络错误，确认失败，请检查连接后重试')
    }
  }

  const openRollbackModal = (record: AnomalyRecord) => {
    setRollbackModal({
      open: true,
      record,
      reason: '',
      submitting: false,
    })
  }

  const closeRollbackModal = () => {
    if (!rollbackModal.submitting) {
      setRollbackModal({
        open: false,
        record: null,
        reason: '',
        submitting: false,
      })
    }
  }

  const handleSubmitRollback = async () => {
    if (!rollbackModal.record || !rollbackModal.reason.trim()) return

    setRollbackModal(prev => ({ ...prev, submitting: true }))
    try {
      const response = await fetch(`/api/anomalies/records/${rollbackModal.record.id}/rollback`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: rollbackModal.reason.trim(),
          changedBy: '实验老师',
          role: 'lab_teacher',
        }),
      })

      const data = await response.json() as { success: boolean; error?: string }

      if (!response.ok || !data.success) {
        setErrorMsg(data.error || '回滚失败，请重试')
        setRollbackModal(prev => ({ ...prev, submitting: false }))
        return
      }

      setRecords(prev => prev.map(r =>
        r.id === rollbackModal.record!.id ? { ...r, status: 'rolled_back' as RecordStatus } : r
      ))
      fetchSummary()
      fetchRollbackLogs()

      setRollbackModal({
        open: false,
        record: null,
        reason: '',
        submitting: false,
      })
    } catch {
      setErrorMsg('网络错误，回滚失败，请检查连接后重试')
      setRollbackModal(prev => ({ ...prev, submitting: false }))
    }
  }

  const handleExport = () => {
    window.open('/api/anomalies/export', '_blank')
  }

  const filteredRecords = records.filter(r =>
    r.sensorId.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const groupedRecords = {
    abnormal: filteredRecords.filter(r => r.directionStatus === 'abnormal'),
    pending_review: filteredRecords.filter(r => r.directionStatus === 'pending_review'),
    confirmed: filteredRecords.filter(r => r.status === 'confirmed'),
    rolled_back: filteredRecords.filter(r => r.status === 'rolled_back'),
  }

  const traceRecords = [
    ...groupedRecords.confirmed,
    ...groupedRecords.rolled_back,
  ].filter(r => {
    const h = r.sensorId + '|' + r.direction + '|' + (r.triggerReason || r.anomalyReason || '')
    return /向左|左|left|临时补材料|补录|补看|B-|临时加材料|回滚|驳回/i.test(h) || r.auditCount > 0
  })

  const getDirectionStatusIcon = (status: DirectionStatus) => {
    switch (status) {
      case 'abnormal':
        return <XCircle className="w-5 h-5" />
      case 'pending_review':
        return <Clock className="w-5 h-5" />
      default:
        return <AlertTriangle className="w-5 h-5" />
    }
  }

  const getRecordStatusStyle = (status: RecordStatus) => {
    switch (status) {
      case 'imported':
        return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'reviewed':
        return 'bg-purple-100 text-purple-700 border-purple-200'
      case 'confirmed':
        return 'bg-green-100 text-green-700 border-green-200'
      case 'rolled_back':
        return 'bg-gray-100 text-gray-700 border-gray-200'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  const getRecordStatusLabel = (status: RecordStatus) => {
    switch (status) {
      case 'imported':
        return '已导入'
      case 'reviewed':
        return '已审阅'
      case 'confirmed':
        return '已确认'
      case 'rolled_back':
        return '已回滚'
      default:
        return status
    }
  }

  const renderAnomalyGroup = (
    list: AnomalyRecord[],
    title: string,
    iconColor: string,
    headerBg: string,
    headerText: string,
  ) => {
    if (list.length === 0) return null

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className={`px-6 py-4 border-b border-gray-100 ${headerBg} ${headerText}`}>
          <div className="flex items-center gap-3">
            <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', iconColor)}>
              {getDirectionStatusIcon(list[0].directionStatus)}
            </div>
            <span className="font-semibold">{title}</span>
            <span className="px-2.5 py-0.5 bg-white/80 rounded text-sm font-medium">
              {list.length} 条
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">原始行号</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">传感器编号</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">温度</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">原始方向值</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">触发原因</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">当前状态</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">更新时间</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {list.map((record) => {
                const canAct = record.status === 'imported' || record.status === 'reviewed'
                return (
                  <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="text-xs text-gray-400">#{record.originalLineNumber}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-medium text-gray-900">{record.sensorId}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-sm text-gray-600">
                        <Thermometer className="w-4 h-4 text-orange-500" />
                        {record.temperature.toFixed(2)}°C
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <Navigation className="w-4 h-4 text-blue-500" />
                        <span className="text-sm font-mono text-gray-700 bg-gray-50 px-2 py-1 rounded">
                          {record.direction}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-start gap-1.5 text-sm text-gray-600 max-w-xs">
                        <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                        <span>{record.triggerReason}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        'px-2.5 py-1 rounded-md text-xs font-medium border',
                        getRecordStatusStyle(record.status)
                      )}>
                        {getRecordStatusLabel(record.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-sm text-gray-500">
                        <Calendar className="w-3.5 h-3.5" />
                        {record.updatedAt}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {canAct && (
                          <>
                            <button
                              onClick={() => handleConfirm(record)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg transition-colors text-sm font-medium border border-green-200"
                              title="实验老师确认"
                            >
                              <CheckCircle className="w-4 h-4" />
                              确认
                            </button>
                            <button
                              onClick={() => openRollbackModal(record)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg transition-colors text-sm font-medium border border-red-200"
                              title="驳回回滚"
                            >
                              <XCircle className="w-4 h-4" />
                              回滚
                            </button>
                          </>
                        )}
                        {!canAct && (
                          <span className="text-sm text-gray-400">已处理</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#1B2A4A]">异常工况表</h2>
          <p className="text-gray-500 mt-1">实验老师处理方向异常和待复核的记录</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={refreshAll}
            className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            刷新
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#1B2A4A] text-white rounded-xl hover:bg-[#1B2A4A]/90 transition-colors shadow-sm"
          >
            <Download className="w-5 h-5" />
            <FileSpreadsheet className="w-4 h-4" />
            导出CSV
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-red-800">{errorMsg}</p>
          </div>
          <button onClick={() => setErrorMsg(null)} className="p-1 hover:bg-red-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-red-500" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-yellow-100 flex items-center justify-center">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">待处理</p>
              <p className="text-2xl font-bold text-yellow-600">
                {summaryLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin inline text-yellow-400" />
                ) : (
                  summary?.pending ?? 0
                )}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">已确认</p>
              <p className="text-2xl font-bold text-green-600">
                {summaryLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin inline text-green-400" />
                ) : (
                  summary?.confirmed ?? 0
                )}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
              <RefreshCw className="w-6 h-6 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">已回滚</p>
              <p className="text-2xl font-bold text-gray-700">
                {summaryLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin inline text-gray-400" />
                ) : (
                  summary?.rolledBack ?? 0
                )}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-red-100 flex items-center justify-center">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">无效数</p>
              <p className="text-2xl font-bold text-red-600">
                {summaryLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin inline text-red-400" />
                ) : (
                  summary?.invalid ?? 0
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="搜索传感器编号..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/20 focus:border-[#1B2A4A]"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center text-gray-500">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />
          加载中...
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">暂无异常记录</p>
        </div>
      ) : (
        <div className="space-y-6">
          {renderAnomalyGroup(
            groupedRecords.pending_review,
            '方向待复核',
            'bg-yellow-100 text-yellow-600',
            'bg-yellow-50',
            'text-yellow-700',
          )}
          {renderAnomalyGroup(
            groupedRecords.abnormal,
            '方向无效（无法进入复核链路）',
            'bg-red-100 text-red-600',
            'bg-red-50',
            'text-red-700',
          )}
          {traceRecords.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 bg-indigo-50 text-indigo-800">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
                    <History className="w-5 h-5" />
                  </div>
                  <span className="font-semibold">向左/临时补材料追踪（含已确认/已回滚）</span>
                  <span className="px-2.5 py-0.5 bg-white/80 rounded text-sm font-medium">
                    {traceRecords.length} 条
                  </span>
                </div>
                <p className="text-xs text-indigo-700/80 mt-1 pl-12">
                  能追回触发导出的明细原始材料：原始行号、原始方向值、触发原因、老岑临时补录痕迹
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">原始行号</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">传感器编号</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">温度</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">当前方向</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">触发原因</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">处理状态</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">审计数</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {traceRecords.map((record) => (
                      <tr key={record.id} className="hover:bg-indigo-50/30 transition-colors">
                        <td className="px-6 py-4">
                          <span className="text-xs text-gray-400">#{record.originalLineNumber}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            'font-medium',
                            /临时补材料|补录|补看|B-/i.test(record.sensorId) ? 'text-indigo-700 bg-indigo-50 px-2 py-1 rounded' : 'text-gray-900'
                          )}>{record.sensorId}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5 text-sm text-gray-600">
                            <Thermometer className="w-4 h-4 text-orange-500" />
                            {record.temperature.toFixed(2)}°C
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5">
                            <Navigation className="w-4 h-4 text-blue-500" />
                            <span className={cn(
                              'text-sm font-mono px-2 py-1 rounded',
                              /向左|左|left/i.test(record.direction) ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-700'
                            )}>
                              {record.direction}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-600">{record.triggerReason || record.anomalyReason || '-'}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            'px-2.5 py-1 rounded-md text-xs font-medium border',
                            getRecordStatusStyle(record.status)
                          )}>
                            {getRecordStatusLabel(record.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            'text-xs px-2 py-0.5 rounded font-medium',
                            record.auditCount > 0 ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'
                          )}>
                            {record.auditCount}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center">
              <History className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <span className="font-semibold text-gray-800">最近回滚记录追踪</span>
              <p className="text-xs text-gray-500 mt-0.5">审计日志中方向字段的变更记录</p>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          {rollbackLogsLoading ? (
            <div className="p-8 text-center text-gray-500">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
              加载中...
            </div>
          ) : rollbackLogs.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <History className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>暂无回滚记录</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">时间</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">字段</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">变更内容</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作人</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">原因</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rollbackLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors bg-purple-50/30">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-sm text-gray-500">
                        <Calendar className="w-3.5 h-3.5" />
                        {log.createdAt}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                        {log.fieldName === 'direction' ? '方向' : log.fieldName}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm flex-wrap">
                        <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded font-mono text-xs">
                          {log.oldValue || '(空)'}
                        </span>
                        <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="px-2 py-0.5 bg-green-100 text-green-600 rounded font-mono text-xs">
                          {log.newValue || '(空)'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-sm text-gray-700">
                        <User className="w-3.5 h-3.5 text-purple-500" />
                        {log.changedBy}
                        <span className="px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded text-xs">
                          {log.role === 'lab_teacher' ? '实验老师' : log.role}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600 max-w-xs truncate">
                        {log.reason || '-'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {rollbackModal.open && rollbackModal.record && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={closeRollbackModal} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                  <XCircle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">驳回回滚</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    传感器 {rollbackModal.record.sensorId} · 行 #{rollbackModal.record.originalLineNumber}
                  </p>
                </div>
              </div>
              <button
                onClick={closeRollbackModal}
                disabled={rollbackModal.submitting}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-500 mb-1">原始方向值</p>
                    <p className="font-mono font-medium text-gray-900 bg-white px-2 py-1 rounded">
                      {rollbackModal.record.direction}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 mb-1">温度</p>
                    <p className="font-medium text-gray-900">
                      {rollbackModal.record.temperature.toFixed(2)}°C
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  回滚原因 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={rollbackModal.reason}
                  onChange={(e) => setRollbackModal(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="请填写驳回回滚的原因..."
                  rows={4}
                  disabled={rollbackModal.submitting}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 disabled:bg-gray-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
              <button
                onClick={closeRollbackModal}
                disabled={rollbackModal.submitting}
                className="px-5 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleSubmitRollback}
                disabled={rollbackModal.submitting || !rollbackModal.reason.trim()}
                className={cn(
                  'flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium transition-all',
                  rollbackModal.submitting || !rollbackModal.reason.trim()
                    ? 'bg-red-300 text-white cursor-not-allowed'
                    : 'bg-red-600 text-white hover:bg-red-700 shadow-sm'
                )}
              >
                {rollbackModal.submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {rollbackModal.submitting ? '提交中...' : '确认回滚'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
