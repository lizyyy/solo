import { useState, useEffect } from 'react'
import {
  Search,
  Filter,
  History,
  X,
  Check,
  Clock,
  AlertCircle,
  User,
  Calendar,
  ChevronRight,
  Edit2,
  Save,
  Loader2,
  AlertTriangle,
} from 'lucide-react'
import type {
  CalibrationRecord,
  AuditLog,
  DirectionStatus,
  RecordStatus,
  PaginatedResponse,
  AuditLogListResponse,
  ApiError,
} from '@/types'
import { cn } from '@/lib/utils'

interface EditingState {
  sensorId: boolean
  direction: boolean
}

export default function ReviewPage() {
  const [records, setRecords] = useState<CalibrationRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [directionStatusFilter, setDirectionStatusFilter] = useState<string>('all')
  const [selectedRecord, setSelectedRecord] = useState<CalibrationRecord | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [editingMap, setEditingMap] = useState<Record<number, EditingState>>({})
  const [editValues, setEditValues] = useState<Record<number, { sensorId: string; direction: string }>>({})
  const [savingId, setSavingId] = useState<number | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const fetchRecords = async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const params = new URLSearchParams()
      if (directionStatusFilter !== 'all') {
        params.set('direction_status', directionStatusFilter)
      }
      params.set('pageSize', '100')

      const response = await fetch(`/api/calibration/records?${params.toString()}`)
      const data = await response.json() as PaginatedResponse<CalibrationRecord> | ApiError

      if (!response.ok) {
        const err = data as ApiError
        setErrorMsg(err.error || '加载记录失败，请刷新重试')
        return
      }

      const result = data as PaginatedResponse<CalibrationRecord>
      setRecords(result.data || [])
    } catch {
      setErrorMsg('网络错误，加载记录失败，请检查连接后重试')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRecords()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directionStatusFilter])

  const fetchAuditLogs = async (recordId: number) => {
    setAuditLoading(true)
    try {
      const response = await fetch(`/api/calibration/records/${recordId}/audit`)
      const data = await response.json() as AuditLogListResponse | ApiError

      if (!response.ok) {
        const err = data as ApiError
        setErrorMsg(err.error || '加载审计日志失败')
        setAuditLogs([])
        return
      }

      const result = data as AuditLogListResponse
      setAuditLogs(result.data || [])
    } catch {
      setErrorMsg('网络错误，加载审计日志失败')
      setAuditLogs([])
    } finally {
      setAuditLoading(false)
    }
  }

  const handleViewHistory = async (record: CalibrationRecord) => {
    setSelectedRecord(record)
    setShowHistory(true)
    setErrorMsg(null)
    await fetchAuditLogs(record.id)
  }

  const handleStartEdit = (recordId: number, field: 'sensorId' | 'direction') => {
    const record = records.find(r => r.id === recordId)
    if (!record) return

    setEditingMap(prev => ({
      ...prev,
      [recordId]: {
        sensorId: field === 'sensorId' ? true : prev[recordId]?.sensorId || false,
        direction: field === 'direction' ? true : prev[recordId]?.direction || false,
      },
    }))

    setEditValues(prev => ({
      ...prev,
      [recordId]: {
        sensorId: prev[recordId]?.sensorId || record.sensorId,
        direction: prev[recordId]?.direction || record.direction,
      },
    }))
  }

  const handleCancelEdit = (recordId: number, field: 'sensorId' | 'direction') => {
    setEditingMap(prev => ({
      ...prev,
      [recordId]: {
        sensorId: field === 'sensorId' ? false : prev[recordId]?.sensorId || false,
        direction: field === 'direction' ? false : prev[recordId]?.direction || false,
      },
    }))
  }

  const handleSaveField = async (recordId: number, field: 'sensorId' | 'direction') => {
    const newValue = editValues[recordId]?.[field]
    if (newValue === undefined) return

    setSavingId(recordId)
    setErrorMsg(null)

    try {
      const reason = field === 'sensorId'
        ? '维修师傅老岑补看/补录传感器编号'
        : '维修师傅老岑修正方向值'

      const response = await fetch(`/api/calibration/records/${recordId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          field_name: field,
          new_value: newValue,
          reason,
          changed_by: '老岑',
          role: 'technician',
        }),
      })

      const data = await response.json() as { success: boolean; data: CalibrationRecord; error?: string }

      if (!response.ok || !data.success) {
        setErrorMsg(data.error || '保存失败，请重试')
        return
      }

      setRecords(prev => prev.map(r => r.id === recordId ? { ...data.data } : r))

      setEditingMap(prev => ({
        ...prev,
        [recordId]: {
          sensorId: field === 'sensorId' ? false : prev[recordId]?.sensorId || false,
          direction: field === 'direction' ? false : prev[recordId]?.direction || false,
        },
      }))
    } catch {
      setErrorMsg('网络错误，保存失败，请检查连接后重试')
    } finally {
      setSavingId(null)
    }
  }

  const filteredRecords = records.filter(record => {
    const matchesSearch = record.sensorId.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = directionStatusFilter === 'all' || record.directionStatus === directionStatusFilter
    return matchesSearch && matchesStatus
  })

  const stats = {
    total: records.length,
    normal: records.filter(r => r.directionStatus === 'normal').length,
    abnormal: records.filter(r => r.directionStatus === 'abnormal').length,
    pending: records.filter(r => r.directionStatus === 'pending_review').length,
  }

  const getDirectionStatusStyle = (status: DirectionStatus) => {
    switch (status) {
      case 'normal':
        return 'bg-green-100 text-green-700 border-green-200'
      case 'abnormal':
        return 'bg-red-100 text-red-700 border-red-200'
      case 'pending_review':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  const getDirectionStatusLabel = (status: DirectionStatus) => {
    switch (status) {
      case 'normal':
        return '正常'
      case 'abnormal':
        return '无效'
      case 'pending_review':
        return '待复核'
      default:
        return status
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

  const getFieldNameLabel = (fieldName: string) => {
    switch (fieldName) {
      case 'sensorId':
        return '传感器编号'
      case 'direction':
        return '方向'
      case 'temperature':
        return '温度'
      default:
        return fieldName
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#1B2A4A]">传感器编号审阅</h2>
          <p className="text-gray-500 mt-1">维修师傅补看/补录传感器编号和方向数据</p>
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
            <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
              <Filter className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">记录总数</p>
              <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
              <Check className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">正常</p>
              <p className="text-2xl font-bold text-green-600">{stats.normal}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-yellow-100 flex items-center justify-center">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">待复核</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-red-100 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">无效</p>
              <p className="text-2xl font-bold text-red-600">{stats.abnormal}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="搜索传感器编号..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/20 focus:border-[#1B2A4A]"
            />
          </div>
          <select
            value={directionStatusFilter}
            onChange={(e) => setDirectionStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/20 focus:border-[#1B2A4A]"
          >
            <option value="all">全部方向状态</option>
            <option value="normal">正常</option>
            <option value="pending_review">待复核</option>
            <option value="abnormal">无效</option>
          </select>
          <button
            onClick={fetchRecords}
            className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-sm text-gray-600"
          >
            刷新
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">原始行号</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">传感器编号</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">温度 (°C)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">方向</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">方向状态</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">记录状态</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">更新时间</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    加载中...
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    暂无记录
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => {
                  const isEditing = editingMap[record.id]
                  const values = editValues[record.id]
                  const isSaving = savingId === record.id

                  return (
                    <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="text-xs text-gray-400">#{record.originalLineNumber}</span>
                      </td>
                      <td className="px-6 py-4">
                        {isEditing?.sensorId ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={values?.sensorId || ''}
                              onChange={(e) => setEditValues(prev => ({
                                ...prev,
                                [record.id]: { ...prev[record.id], sensorId: e.target.value },
                              }))}
                              className="px-2 py-1 border border-gray-300 rounded text-sm w-32 focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/20"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveField(record.id, 'sensorId')}
                              disabled={isSaving}
                              className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
                              title="保存"
                            >
                              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => handleCancelEdit(record.id, 'sensorId')}
                              className="p-1 text-gray-400 hover:bg-gray-100 rounded transition-colors"
                              title="取消"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span className="font-medium text-gray-900">{record.sensorId}</span>
                            <button
                              onClick={() => handleStartEdit(record.id, 'sensorId')}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                              title="编辑传感器编号"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{record.temperature.toFixed(2)}</td>
                      <td className="px-6 py-4">
                        {isEditing?.direction ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={values?.direction || ''}
                              onChange={(e) => setEditValues(prev => ({
                                ...prev,
                                [record.id]: { ...prev[record.id], direction: e.target.value },
                              }))}
                              className="px-2 py-1 border border-gray-300 rounded text-sm w-28 font-mono focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/20"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveField(record.id, 'direction')}
                              disabled={isSaving}
                              className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
                              title="保存"
                            >
                              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => handleCancelEdit(record.id, 'direction')}
                              className="p-1 text-gray-400 hover:bg-gray-100 rounded transition-colors"
                              title="取消"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span className="text-sm text-gray-600 font-mono">{record.direction}</span>
                            <button
                              onClick={() => handleStartEdit(record.id, 'direction')}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                              title="编辑方向"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          'px-2.5 py-1 rounded-md text-xs font-medium border',
                          getDirectionStatusStyle(record.directionStatus)
                        )}>
                          {getDirectionStatusLabel(record.directionStatus)}
                        </span>
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
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Calendar className="w-4 h-4" />
                          {record.updatedAt}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleViewHistory(record)}
                            className="flex items-center gap-1 px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors text-sm"
                            title="查看改动历史"
                          >
                            <History className="w-4 h-4" />
                            <span className="hidden sm:inline">改动历史</span>
                            {record.auditCount > 0 && (
                              <span className="px-1.5 py-0.5 bg-[#1B2A4A]/10 text-[#1B2A4A] rounded text-xs">
                                {record.auditCount}
                              </span>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showHistory && selectedRecord && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowHistory(false)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">改动历史</h3>
                <p className="text-sm text-gray-500">
                  {selectedRecord.sensorId} · 行 #{selectedRecord.originalLineNumber}
                </p>
              </div>
              <button
                onClick={() => setShowHistory(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {auditLoading ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                  <Loader2 className="w-8 h-8 animate-spin mb-3" />
                  加载中...
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <History className="w-12 h-12 mb-3 opacity-50" />
                  <p>暂无改动记录</p>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200" />
                  {auditLogs.map((log) => (
                    <div key={log.id} className="relative pl-10 pb-6 last:pb-0">
                      <div className="absolute left-0 w-8 h-8 rounded-full bg-[#1B2A4A] flex items-center justify-center">
                        <Edit2 className="w-4 h-4 text-white" />
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-900">
                            修改 {getFieldNameLabel(log.fieldName)}
                          </span>
                          <span className="text-xs text-gray-500">{log.createdAt}</span>
                        </div>
                        {log.oldValue !== undefined && log.newValue !== undefined && (
                          <div className="flex items-center gap-2 text-sm mb-2 flex-wrap">
                            <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded font-mono text-xs">
                              {log.oldValue || '(空)'}
                            </span>
                            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <span className="px-2 py-0.5 bg-green-100 text-green-600 rounded font-mono text-xs">
                              {log.newValue || '(空)'}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <User className="w-4 h-4" />
                          {log.changedBy}
                          <span className="px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded text-xs">
                            {log.role === 'technician' ? '维修师傅' : log.role === 'lab_teacher' ? '实验老师' : log.role}
                          </span>
                        </div>
                        {log.reason && (
                          <div className="mt-2 text-sm text-gray-500 italic bg-white/60 rounded p-2">
                            <AlertTriangle className="w-3.5 h-3.5 inline mr-1 text-yellow-500" />
                            {log.reason}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
