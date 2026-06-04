import { useState, useEffect } from "react"
import { Search, Filter, History, X, Check, Clock, AlertTriangle, User, Calendar, ChevronRight, Edit2 } from "lucide-react"
import type { CalibrationRecord, AuditLog } from "@/types"
import { cn } from "@/lib/utils"

const mockRecords: CalibrationRecord[] = [
  { id: '1', rowNumber: 1, sensorId: 'SENS-001', temperature: 23.5, direction: 'UP', directionStatus: 'valid', reviewed: true, reviewer: '张三', reviewTime: '2024-01-15 10:30', importTime: '2024-01-15 10:00', fileName: 'data_20240115.csv' },
  { id: '2', rowNumber: 2, sensorId: 'SENS-002', temperature: 24.2, direction: 'DOWN', directionStatus: 'valid', reviewed: true, reviewer: '张三', reviewTime: '2024-01-15 10:35', importTime: '2024-01-15 10:00', fileName: 'data_20240115.csv' },
  { id: '3', rowNumber: 3, sensorId: 'SENS-003', temperature: 22.8, direction: 'U', directionStatus: 'pending_review', reviewed: false, importTime: '2024-01-15 10:00', fileName: 'data_20240115.csv' },
  { id: '4', rowNumber: 4, sensorId: 'SENS-004', temperature: 25.1, direction: 'L', directionStatus: 'pending_review', reviewed: false, importTime: '2024-01-15 10:00', fileName: 'data_20240115.csv' },
  { id: '5', rowNumber: 5, sensorId: 'SENS-005', temperature: 23.9, direction: 'LEFT', directionStatus: 'valid', reviewed: true, reviewer: '李四', reviewTime: '2024-01-15 11:00', importTime: '2024-01-15 10:00', fileName: 'data_20240115.csv' },
  { id: '6', rowNumber: 6, sensorId: 'SENS-006', temperature: 24.5, direction: 'R', directionStatus: 'pending_review', reviewed: false, importTime: '2024-01-15 10:00', fileName: 'data_20240115.csv' },
  { id: '7', rowNumber: 7, sensorId: 'SENS-007', temperature: 23.2, direction: 'RIGHT', directionStatus: 'valid', reviewed: true, reviewer: '李四', reviewTime: '2024-01-15 11:05', importTime: '2024-01-15 10:00', fileName: 'data_20240115.csv' },
  { id: '8', rowNumber: 8, sensorId: 'SENS-008', temperature: 22.5, direction: 'D', directionStatus: 'pending_review', reviewed: false, importTime: '2024-01-15 10:00', fileName: 'data_20240115.csv' },
]

const mockAuditLogs: AuditLog[] = [
  { id: '1', recordId: '3', sensorId: 'SENS-003', action: 'create', operator: 'system', operateTime: '2024-01-15 10:00', remark: '数据导入' },
  { id: '2', recordId: '3', sensorId: 'SENS-003', action: 'update', field: 'direction', oldValue: 'U', newValue: 'UP', operator: '张三', operateTime: '2024-01-15 10:20', remark: '修正方向值' },
  { id: '3', recordId: '3', sensorId: 'SENS-003', action: 'review', operator: '张三', operateTime: '2024-01-15 10:30', remark: '审核通过' },
]

export default function ReviewPage() {
  const [records, setRecords] = useState<CalibrationRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedRecord, setSelectedRecord] = useState<CalibrationRecord | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [editingRecord, setEditingRecord] = useState<CalibrationRecord | null>(null)
  const [editDirection, setEditDirection] = useState('')

  useEffect(() => {
    fetchRecords()
  }, [])

  const fetchRecords = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/calibration/records?status=pending_review')
      if (response.ok) {
        const data = await response.json() as CalibrationRecord[]
        setRecords(data)
      } else {
        setRecords(mockRecords)
      }
    } catch {
      setRecords(mockRecords)
    } finally {
      setLoading(false)
    }
  }

  const fetchAuditLogs = async (recordId: string) => {
    try {
      const response = await fetch(`/api/calibration/records/${recordId}/audit-logs`)
      if (response.ok) {
        const data = await response.json() as AuditLog[]
        setAuditLogs(data)
      } else {
        setAuditLogs(mockAuditLogs.filter(log => log.recordId === recordId))
      }
    } catch {
      setAuditLogs(mockAuditLogs.filter(log => log.recordId === recordId))
    }
  }

  const handleViewHistory = async (record: CalibrationRecord) => {
    setSelectedRecord(record)
    setShowHistory(true)
    await fetchAuditLogs(record.id)
  }

  const handleApprove = async (record: CalibrationRecord) => {
    try {
      const response = await fetch(`/api/calibration/records/${record.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'valid', reviewer: '当前用户' }),
      })
      if (response.ok) {
        setRecords(prev => prev.map(r =>
          r.id === record.id ? { ...r, directionStatus: 'valid' as const, reviewed: true, reviewer: '当前用户', reviewTime: new Date().toISOString() } : r
        ))
      }
    } catch {
      setRecords(prev => prev.map(r =>
        r.id === record.id ? { ...r, directionStatus: 'valid' as const, reviewed: true, reviewer: '当前用户', reviewTime: new Date().toISOString() } : r
      ))
    }
  }

  const handleEdit = (record: CalibrationRecord) => {
    setEditingRecord(record)
    setEditDirection(record.direction)
  }

  const handleSaveEdit = async () => {
    if (!editingRecord) return
    try {
      const response = await fetch(`/api/calibration/records/${editingRecord.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction: editDirection }),
      })
      if (response.ok) {
        setRecords(prev => prev.map(r =>
          r.id === editingRecord.id ? { ...r, direction: editDirection } : r
        ))
      }
    } catch {
      setRecords(prev => prev.map(r =>
        r.id === editingRecord.id ? { ...r, direction: editDirection } : r
      ))
    }
    setEditingRecord(null)
  }

  const filteredRecords = records.filter(record => {
    const matchesSearch = record.sensorId.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || record.directionStatus === statusFilter
    return matchesSearch && matchesStatus
  })

  const stats = {
    total: records.length,
    pending: records.filter(r => r.directionStatus === 'pending_review').length,
    approved: records.filter(r => r.directionStatus === 'valid' && r.reviewed).length,
  }

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'valid':
        return 'bg-green-100 text-green-700 border-green-200'
      case 'invalid':
        return 'bg-red-100 text-red-700 border-red-200'
      case 'pending_review':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'valid':
        return '已通过'
      case 'invalid':
        return '已拒绝'
      case 'pending_review':
        return '待复核'
      default:
        return status
    }
  }

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'create':
        return '创建'
      case 'update':
        return '更新'
      case 'review':
        return '审核'
      case 'delete':
        return '删除'
      default:
        return action
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#1B2A4A]">传感器编号审阅</h2>
          <p className="text-gray-500 mt-1">审核校准记录中的传感器编号和方向数据</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
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
            <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
              <Check className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">已通过</p>
              <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
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
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/20 focus:border-[#1B2A4A]"
          >
            <option value="all">全部状态</option>
            <option value="pending_review">待复核</option>
            <option value="valid">已通过</option>
            <option value="invalid">已拒绝</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">传感器编号</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">温度 (°C)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">方向</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">审核人</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">导入时间</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">加载中...</td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">暂无记录</td>
                </tr>
              ) : (
                filteredRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-medium text-gray-900">{record.sensorId}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{record.temperature.toFixed(2)}</td>
                    <td className="px-6 py-4">
                      {editingRecord?.id === record.id ? (
                        <input
                          type="text"
                          value={editDirection}
                          onChange={(e) => setEditDirection(e.target.value)}
                          className="px-2 py-1 border border-gray-300 rounded text-sm w-20 focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/20"
                          autoFocus
                        />
                      ) : (
                        <span className="text-sm text-gray-600 font-mono">{record.direction}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2.5 py-1 rounded-md text-xs font-medium border",
                        getStatusStyle(record.directionStatus)
                      )}>
                        {getStatusLabel(record.directionStatus)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {record.reviewer ? (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <User className="w-4 h-4" />
                          {record.reviewer}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="w-4 h-4" />
                        {record.importTime}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {record.directionStatus === 'pending_review' && (
                          <>
                            {editingRecord?.id === record.id ? (
                              <>
                                <button
                                  onClick={handleSaveEdit}
                                  className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                  title="保存"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setEditingRecord(null)}
                                  className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
                                  title="取消"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => handleEdit(record)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="编辑"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            )}
                            {!editingRecord && (
                              <button
                                onClick={() => handleApprove(record)}
                                className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                title="通过"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            )}
                          </>
                        )}
                        <button
                          onClick={() => handleViewHistory(record)}
                          className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                          title="查看历史"
                        >
                          <History className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showHistory && selectedRecord && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowHistory(false)} />
          <div className="absolute right-0 top-0 h-full w-96 bg-white shadow-2xl flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">改动历史</h3>
                <p className="text-sm text-gray-500">{selectedRecord.sensorId}</p>
              </div>
              <button
                onClick={() => setShowHistory(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200" />
                {auditLogs.map((log, index) => (
                  <div key={log.id} className="relative pl-10 pb-6 last:pb-0">
                    <div className="absolute left-0 w-8 h-8 rounded-full bg-[#1B2A4A] flex items-center justify-center">
                      {log.action === 'create' && <Calendar className="w-4 h-4 text-white" />}
                      {log.action === 'update' && <Edit2 className="w-4 h-4 text-white" />}
                      {log.action === 'review' && <Check className="w-4 h-4 text-white" />}
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-900">{getActionLabel(log.action)}</span>
                        <span className="text-xs text-gray-500">{log.operateTime}</span>
                      </div>
                      {log.field && (
                        <div className="text-sm text-gray-600 mb-2">
                          <span className="text-gray-500">字段：</span>{log.field}
                        </div>
                      )}
                      {log.oldValue && log.newValue && (
                        <div className="flex items-center gap-2 text-sm mb-2">
                          <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded">{log.oldValue}</span>
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                          <span className="px-2 py-0.5 bg-green-100 text-green-600 rounded">{log.newValue}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <User className="w-4 h-4" />
                        {log.operator}
                      </div>
                      {log.remark && (
                        <div className="mt-2 text-sm text-gray-500 italic">{log.remark}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
