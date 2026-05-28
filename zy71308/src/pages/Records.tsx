import { useState, useEffect, useCallback } from 'react'
import { useStore } from '@/store/useStore'
import { ChevronDown, ChevronRight, Search } from 'lucide-react'

const STATUS_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'draft', label: '草稿' },
  { value: 'validated', label: '已校验' },
  { value: 'approved', label: '已审核' },
  { value: 'archived', label: '已归档' },
]

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-bg-input text-txt-secondary',
  validated: 'bg-laser-blueDim text-laser-blue',
  approved: 'bg-laser-greenDim text-laser-green',
  archived: 'bg-laser-purpleDim text-laser-purple',
}

const STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  validated: '已校验',
  approved: '已审核',
  archived: '已归档',
  withdrawn: '已撤回',
}

const RISK_COLORS: Record<string, string> = {
  safe: 'bg-laser-green',
  warning: 'bg-amber',
  danger: 'bg-laser-red',
}

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-laser-greenDim text-laser-green',
  validate: 'bg-laser-blueDim text-laser-blue',
  approve: 'bg-laser-greenDim text-laser-green',
  reject: 'bg-amber-dim text-amber',
  withdraw: 'bg-laser-redDim text-laser-red',
  retroact: 'bg-laser-purpleDim text-laser-purple',
  archive: 'bg-bg-input text-txt-secondary',
  reactivate: 'bg-laser-blueDim text-laser-blue',
  update: 'bg-amber-dim text-amber',
}

type ModalState =
  | { type: 'reject'; id: number }
  | { type: 'withdraw'; id: number }
  | { type: 'approve'; id: number }
  | null

export default function Records() {
  const {
    materials,
    records,
    auditLogs,
    loading,
    fetchMaterials,
    fetchRecords,
    fetchAuditLogs,
    clearAuditLogs,
    validateRecord,
    approveRecord,
    rejectRecord,
    withdrawRecord,
    retroactRecord,
    archiveRecord,
    reactivateRecord,
  } = useStore()

  const [materialFilter, setMaterialFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [modal, setModal] = useState<ModalState>(null)
  const [modalInput, setModalInput] = useState('')
  const [operatorName] = useState('操作员')

  useEffect(() => {
    fetchMaterials()
    fetchRecords()
  }, [])

  const handleQuery = useCallback(() => {
    const filters: Record<string, string> = {}
    if (materialFilter) filters.material_id = materialFilter
    if (statusFilter) filters.status = statusFilter
    if (dateFrom) filters.date_from = dateFrom
    if (dateTo) filters.date_to = dateTo
    fetchRecords(filters)
  }, [materialFilter, statusFilter, dateFrom, dateTo, fetchRecords])

  const handleToggleExpand = useCallback(
    (id: number) => {
      if (expandedId === id) {
        setExpandedId(null)
        clearAuditLogs()
      } else {
        setExpandedId(id)
        fetchAuditLogs(id)
      }
    },
    [expandedId, fetchAuditLogs, clearAuditLogs]
  )

  const handleAction = useCallback(
    async (action: string, id: number) => {
      switch (action) {
        case 'validate':
          await validateRecord(id)
          break
        case 'approve':
          setModal({ type: 'approve', id })
          return
        case 'reject':
          setModal({ type: 'reject', id })
          return
        case 'withdraw':
          setModal({ type: 'withdraw', id })
          return
        case 'archive':
          await archiveRecord(id, operatorName)
          break
        case 'reactivate':
          await reactivateRecord(id, operatorName)
          break
        case 'retroact':
          await retroactRecord(id)
          break
      }
      fetchRecords()
    },
    [validateRecord, archiveRecord, reactivateRecord, retroactRecord, fetchRecords, operatorName]
  )

  const handleModalConfirm = useCallback(async () => {
    if (!modal) return
    if (modal.type === 'reject') {
      await rejectRecord(modal.id, modalInput, operatorName)
    } else if (modal.type === 'withdraw') {
      await withdrawRecord(modal.id, modalInput, operatorName)
    } else if (modal.type === 'approve') {
      await approveRecord(modal.id, modalInput)
    }
    setModal(null)
    setModalInput('')
    fetchRecords()
  }, [modal, modalInput, operatorName, rejectRecord, withdrawRecord, approveRecord, fetchRecords])

  const closeModal = useCallback(() => {
    setModal(null)
    setModalInput('')
  }, [])

  const renderActionButtons = (record: (typeof records)[0]) => {
    const buttons: { action: string; label: string; color: string }[] = []
    switch (record.status) {
      case 'draft':
        buttons.push({ action: 'validate', label: '校验', color: 'bg-laser-blueDim text-laser-blue hover:bg-laser-blue/25' })
        break
      case 'validated':
        buttons.push({ action: 'approve', label: '通过', color: 'bg-laser-greenDim text-laser-green hover:bg-laser-green/25' })
        buttons.push({ action: 'reject', label: '退回', color: 'bg-amber-dim text-amber hover:bg-amber/25' })
        break
      case 'approved':
        buttons.push({ action: 'archive', label: '归档', color: 'bg-laser-purpleDim text-laser-purple hover:bg-laser-purple/25' })
        buttons.push({ action: 'withdraw', label: '撤回', color: 'bg-laser-redDim text-laser-red hover:bg-laser-red/25' })
        break
      case 'archived':
        buttons.push({ action: 'reactivate', label: '激活', color: 'bg-laser-blueDim text-laser-blue hover:bg-laser-blue/25' })
        break
    }
    buttons.push({ action: 'retroact', label: '补录', color: 'bg-amber-dim text-amber hover:bg-amber/25' })
    return buttons
  }

  const parseChanges = (changesStr: string) => {
    try {
      return JSON.parse(changesStr)
    } catch {
      return null
    }
  }

  return (
    <div className="h-full overflow-auto p-6">
      <h1 className="text-2xl font-semibold text-txt-primary mb-6">工艺记录</h1>

      <div className="flex items-end gap-3 mb-6 bg-bg-card rounded-xl p-4 border border-border">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-txt-muted">材料</label>
          <select
            value={materialFilter}
            onChange={(e) => setMaterialFilter(e.target.value)}
            className="bg-bg-input border border-border rounded-lg px-3 py-1.5 text-sm text-txt-primary outline-none focus:border-laser-blue"
          >
            <option value="">全部</option>
            {materials.map((m) => (
              <option key={m.id} value={String(m.id)}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-txt-muted">状态</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-bg-input border border-border rounded-lg px-3 py-1.5 text-sm text-txt-primary outline-none focus:border-laser-blue"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-txt-muted">起始日期</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="bg-bg-input border border-border rounded-lg px-3 py-1.5 text-sm text-txt-primary outline-none focus:border-laser-blue"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-txt-muted">截止日期</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="bg-bg-input border border-border rounded-lg px-3 py-1.5 text-sm text-txt-primary outline-none focus:border-laser-blue"
          />
        </div>

        <button
          onClick={handleQuery}
          className="flex items-center gap-1.5 bg-laser-blue text-white rounded-lg px-4 py-1.5 text-sm font-medium hover:bg-laser-blue/80 transition-colors"
        >
          <Search className="w-4 h-4" />
          查询
        </button>
      </div>

      <div className="bg-bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-txt-muted text-xs">
                <th className="w-8 px-2 py-3"></th>
                <th className="text-left px-3 py-3 font-medium">ID</th>
                <th className="text-left px-3 py-3 font-medium">材料</th>
                <th className="text-left px-3 py-3 font-medium">功率(W)</th>
                <th className="text-left px-3 py-3 font-medium">速度(mm/s)</th>
                <th className="text-left px-3 py-3 font-medium">焦距(mm)</th>
                <th className="text-left px-3 py-3 font-medium">线宽(mm)</th>
                <th className="text-left px-3 py-3 font-medium">能量密度(J/mm²)</th>
                <th className="text-left px-3 py-3 font-medium">风险等级</th>
                <th className="text-left px-3 py-3 font-medium">状态</th>
                <th className="text-left px-3 py-3 font-medium">补录</th>
                <th className="text-left px-3 py-3 font-medium">操作人</th>
                <th className="text-left px-3 py-3 font-medium">创建时间</th>
                <th className="text-left px-3 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <>
                  <tr
                    key={record.id}
                    className="border-b border-border hover:bg-bg-card/80 cursor-pointer transition-colors"
                    onClick={() => handleToggleExpand(record.id)}
                  >
                    <td className="px-2 py-3 text-txt-muted">
                      {expandedId === record.id ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </td>
                    <td className="px-3 py-3 text-txt-secondary font-mono">{record.id}</td>
                    <td className="px-3 py-3 text-txt-primary">{record.material_name}</td>
                    <td className="px-3 py-3 text-txt-primary font-mono">{record.laser_power}</td>
                    <td className="px-3 py-3 text-txt-primary font-mono">{record.move_speed}</td>
                    <td className="px-3 py-3 text-txt-primary font-mono">{record.focal_length}</td>
                    <td className="px-3 py-3 text-txt-primary font-mono">{record.line_width}</td>
                    <td className="px-3 py-3 font-mono text-amber font-medium">{record.energy_density.toFixed(2)}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-block w-2.5 h-2.5 rounded-full ${RISK_COLORS[record.risk_level] || 'bg-txt-muted'}`} />
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[record.status] || 'bg-bg-input text-txt-muted'}`}>
                        {STATUS_LABELS[record.status] || record.status}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {record.is_retroactive === 1 && (
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-dim text-amber">补录</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-txt-secondary">{record.operator}</td>
                    <td className="px-3 py-3 text-txt-muted text-xs">{new Date(record.created_at).toLocaleString('zh-CN')}</td>
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5">
                        {renderActionButtons(record).map((btn) => (
                          <button
                            key={btn.action}
                            onClick={() => handleAction(btn.action, record.id)}
                            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${btn.color}`}
                          >
                            {btn.label}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                  {expandedId === record.id && (
                    <tr key={`audit-${record.id}`}>
                      <td colSpan={14} className="px-6 py-4 bg-bg-secondary/50">
                        <div className="relative pl-6">
                          {auditLogs.length === 0 && !loading && (
                            <p className="text-txt-muted text-sm py-2">暂无审计轨迹</p>
                          )}
                          {auditLogs.map((log) => {
                            const changes = parseChanges(log.changes)
                            return (
                              <div key={log.id} className="relative flex gap-4 pb-5 last:pb-0">
                                <div className="absolute left-0 top-2 w-2.5 h-2.5 rounded-full bg-laser-blue border-2 border-bg-secondary z-10" />
                                <div className="ml-5 flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${ACTION_COLORS[log.action] || 'bg-bg-input text-txt-muted'}`}>
                                      {log.action}
                                    </span>
                                    <span className="text-txt-muted text-xs">{new Date(log.created_at).toLocaleString('zh-CN')}</span>
                                    <span className="text-txt-secondary text-xs">{log.operator}</span>
                                  </div>
                                  {changes && typeof changes === 'object' && (
                                    <div className="text-xs text-txt-secondary space-y-0.5 mt-1">
                                      {Object.entries(changes).map(([key, val]) => {
                                        const v = val as { from: unknown; to: unknown }
                                        return (
                                          <div key={key}>
                                            <span className="text-txt-muted">{key}：</span>
                                            <span className="text-laser-red">{String(v.from)}</span>
                                            <span className="text-txt-muted mx-1">→</span>
                                            <span className="text-laser-green">{String(v.to)}</span>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  )}
                                  {log.reason && (
                                    <p className="text-xs text-txt-muted mt-1">原因：{log.reason}</p>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                          {auditLogs.length > 0 && (
                            <div className="absolute left-[4px] top-3 bottom-3 w-px bg-border" />
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {records.length === 0 && !loading && (
                <tr>
                  <td colSpan={14} className="text-center py-12 text-txt-muted">
                    暂无记录
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={closeModal}>
          <div className="bg-bg-card rounded-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-txt-primary mb-4">
              {modal.type === 'reject' && '退回记录'}
              {modal.type === 'withdraw' && '撤回记录'}
              {modal.type === 'approve' && '审核通过'}
            </h3>
            {modal.type === 'approve' ? (
              <div className="mb-4">
                <label className="text-sm text-txt-muted mb-1 block">审核人姓名</label>
                <input
                  value={modalInput}
                  onChange={(e) => setModalInput(e.target.value)}
                  placeholder="请输入审核人姓名"
                  className="w-full bg-bg-input border border-border rounded-lg px-3 py-2 text-sm text-txt-primary outline-none focus:border-laser-blue"
                />
              </div>
            ) : (
              <div className="mb-4">
                <label className="text-sm text-txt-muted mb-1 block">原因</label>
                <textarea
                  value={modalInput}
                  onChange={(e) => setModalInput(e.target.value)}
                  placeholder="请输入原因"
                  rows={3}
                  className="w-full bg-bg-input border border-border rounded-lg px-3 py-2 text-sm text-txt-primary outline-none focus:border-laser-blue resize-none"
                />
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button onClick={closeModal} className="px-4 py-2 rounded-lg text-sm text-txt-secondary hover:bg-bg-input transition-colors">
                取消
              </button>
              <button
                onClick={handleModalConfirm}
                disabled={!modalInput.trim()}
                className="px-4 py-2 rounded-lg text-sm bg-laser-blue text-white hover:bg-laser-blue/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
