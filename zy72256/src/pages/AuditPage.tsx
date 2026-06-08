import { useEffect, useState } from 'react'
import { useStore } from '@/store'
import { RotateCcw, AlertCircle } from 'lucide-react'
import StatusBadge from '@/components/StatusBadge'
import TypeBadge from '@/components/TypeBadge'
import { ACTION_LABELS, ROLE_LABELS, STATUS_LABELS } from '@shared/types'
import type { RecordStatus, CoordinateRecord, AuditLog } from '@shared/types'

export default function AuditPage() {
  const records = useStore((s) => s.records)
  const auditLogs = useStore((s) => s.auditLogs)
  const loading = useStore((s) => s.loading)
  const fetchRecords = useStore((s) => s.fetchRecords)
  const fetchAuditLogs = useStore((s) => s.fetchAuditLogs)
  const rollbackRecord = useStore((s) => s.rollbackRecord)
  const role = useStore((s) => s.role)

  const [selectedRecord, setSelectedRecord] = useState<CoordinateRecord | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [rollbackTarget, setRollbackTarget] = useState<string | null>(null)
  const [rollbackReason, setRollbackReason] = useState('')
  const [showRollbackModal, setShowRollbackModal] = useState(false)

  useEffect(() => {
    fetchRecords()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectRecord = async (record: CoordinateRecord) => {
    setSelectedRecord(record)
    await fetchAuditLogs(record.id)
  }

  const filteredRecords = statusFilter === 'all'
    ? records
    : records.filter((r) => r.status === statusFilter)

  const handleRollbackClick = (logId: string) => {
    setRollbackTarget(logId)
    setRollbackReason('')
    setShowRollbackModal(true)
  }

  const handleRollbackConfirm = async () => {
    if (!selectedRecord || !rollbackTarget || !rollbackReason.trim()) return
    await rollbackRecord({
      record_id: selectedRecord.id,
      target_audit_log_id: rollbackTarget,
      operator: role === 'instructor' ? '老梁' : role,
      reason: rollbackReason,
    })
    setShowRollbackModal(false)
    setRollbackTarget(null)
    setRollbackReason('')
    if (selectedRecord) {
      await fetchAuditLogs(selectedRecord.id)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">审计追踪</h2>
        <p className="text-gray-500 mt-1">查看所有记录的操作历史与状态变更</p>
      </div>

      <div className="flex gap-6 min-h-[600px]">
        <div className="w-80 flex-shrink-0 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-[#1a3a4a]"
            >
              <option value="all">全部状态</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {filteredRecords.map((r) => (
              <button
                key={r.id}
                onClick={() => handleSelectRecord(r)}
                className={`w-full text-left px-4 py-3 transition-colors ${
                  selectedRecord?.id === r.id ? 'bg-[#1a3a4a]/5 border-l-3 border-l-[#e8943a]' : 'hover:bg-gray-50 border-l-3 border-transparent'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900 truncate">{r.building_name}</span>
                  <span className="text-xs text-gray-400 font-mono">#{r.original_line_number}</span>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <TypeBadge type={r.coordinate_type} />
                  <StatusBadge status={r.status} />
                </div>
              </button>
            ))}
            {filteredRecords.length === 0 && (
              <div className="px-4 py-10 text-center text-gray-400 text-sm">暂无记录</div>
            )}
          </div>
        </div>

        <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200">
          {!selectedRecord ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              选择左侧记录查看审计时间线
            </div>
          ) : (
            <div className="p-5">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">{selectedRecord.building_name}</h3>
              <p className="text-sm text-gray-500 mb-6">行号 #{selectedRecord.original_line_number}</p>

              {auditLogs.length === 0 ? (
                <div className="text-center text-gray-400 py-10">暂无审计日志</div>
              ) : (
                <div className="relative pl-7">
                  <div className="timeline-line" />
                  {auditLogs.map((log: AuditLog, i: number) => (
                    <div key={log.id} className="relative pb-6 last:pb-0 fade-in" style={{ animationDelay: `${i * 100}ms` }}>
                      <div className={`timeline-dot absolute -left-7 top-1 ${i === 0 ? 'timeline-dot-active' : ''}`} />
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900">{log.operator}</span>
                            <span className="text-xs text-gray-400">{ROLE_LABELS[log.operator_role]}</span>
                          </div>
                          <span className="text-xs text-gray-400">{new Date(log.created_at).toLocaleString('zh-CN')}</span>
                        </div>
                        <p className="text-sm text-gray-700 mb-2">
                          {ACTION_LABELS[log.action]} · {log.change_detail}
                        </p>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="px-2 py-0.5 rounded bg-gray-200 text-gray-600">{STATUS_LABELS[log.previous_status as RecordStatus] || log.previous_status}</span>
                          <span className="text-gray-400">→</span>
                          <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700">{STATUS_LABELS[log.new_status as RecordStatus] || log.new_status}</span>
                        </div>
                        {role === 'inspector' && i > 0 && (
                          <button
                            onClick={() => handleRollbackClick(log.id)}
                            className="mt-3 flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 transition-colors"
                          >
                            <RotateCcw size={12} />
                            回滚到此版本
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showRollbackModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle size={20} className="text-red-500" />
              <h3 className="text-lg font-semibold text-gray-900">确认回滚</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              此操作将回滚到选定版本的状态，请填写回滚原因：
            </p>
            <textarea
              value={rollbackReason}
              onChange={(e) => setRollbackReason(e.target.value)}
              placeholder="输入回滚原因"
              rows={3}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-red-400 resize-none mb-4"
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowRollbackModal(false)}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleRollbackConfirm}
                disabled={!rollbackReason.trim() || loading}
                className="px-4 py-2 text-sm text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                确认回滚
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
