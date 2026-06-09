import { useState, useEffect } from 'react'
import { useStore } from '@/store'
import { fetchRecords, reviewRecord, confirmRecord, rollbackRecord, fetchAuditLogs, uploadPhoto, fetchPhotos } from '@/api'
import { StatusBadge, CredibilityBadge, UnitBadge, SourceBadge } from '@/components/Badges'
import { ClipboardCheck, Camera, History, RotateCcw, CheckCircle, Image, X, Eye, ArrowRight, Shield, UserCheck } from 'lucide-react'
import type { RecordDetail, AuditLogEntry, PhotoEntry } from '@/store'
import { cn } from '@/lib/utils'

const roleMap: Record<string, string> = {
  engineer: '实验工程师',
  maintenance_worker: '维修师傅',
  training_coach: '训练教练',
}

const actionMap: Record<string, string> = {
  import: '首次导入',
  review: '复核修改',
  confirm: '教练确认',
  rollback: '回滚',
  edit: '编辑',
}

export default function ReviewPage() {
  const {
    records,
    recordsTotal,
    recordsFilter,
    setRecords,
    setSelectedRecord,
    selectedRecord,
    auditLogs,
    photos,
    setAuditLogs,
    setPhotos,
    updateRecord,
    currentRole,
    refreshReport,
  } = useStore()

  const [statusFilter, setStatusFilter] = useState<string>(recordsFilter.status || 'mixed_unit')
  const [credibilityFilter, setCredibilityFilter] = useState<string>('')
  const [noteValue, setNoteValue] = useState('')
  const [correctedValue, setCorrectedValue] = useState<string>('')
  const [correctedUnit, setCorrectedUnit] = useState<'C' | 'K'>('C')
  const [rollbackReason, setRollbackReason] = useState('')
  const [showRollback, setShowRollback] = useState(false)
  const [photoDescription, setPhotoDescription] = useState('')
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  useEffect(() => {
    loadRecords()
  }, [statusFilter])

  useEffect(() => {
    if (selectedRecord) {
      loadDetail(selectedRecord.id)
    }
  }, [selectedRecord])

  async function loadRecords() {
    try {
      const result = await fetchRecords({
        status: statusFilter || undefined,
        pageSize: 100,
      })
      setRecords(result.records as RecordDetail[], result.total)
    } catch (e) {
      console.error(e)
    }
  }

  async function loadDetail(id: string) {
    try {
      const [logs, ph] = await Promise.all([fetchAuditLogs(id), fetchPhotos(id)])
      setAuditLogs(logs as AuditLogEntry[])
      setPhotos(ph as PhotoEntry[])
    } catch (e) {
      console.error(e)
    }
  }

  async function handleReview(credibility: 'sensor_trusted' | 'photo_trusted' | 'pending_confirmation') {
    if (!selectedRecord) return
    const payload: any = { credibility, operatorRole: currentRole }
    if (credibility === 'photo_trusted' && correctedValue) {
      payload.correctedValue = parseFloat(correctedValue)
      payload.correctedUnit = correctedUnit
    }
    if (noteValue) payload.note = noteValue
    try {
      const updated = await reviewRecord(selectedRecord.id, payload)
      await updateRecord(updated as RecordDetail)
      await refreshReport()
      setNoteValue('')
      setCorrectedValue('')
      await loadRecords()
      await loadDetail(selectedRecord.id)
    } catch (e: any) {
      alert('复核失败：' + (e.message || e))
    }
  }

  async function handleConfirm() {
    if (!selectedRecord) return
    try {
      const updated = await confirmRecord(selectedRecord.id, currentRole, noteValue || undefined)
      await updateRecord(updated as RecordDetail)
      await refreshReport()
      setNoteValue('')
      await loadRecords()
      await loadDetail(selectedRecord.id)
    } catch (e: any) {
      alert('确认失败：' + (e.message || e))
    }
  }

  async function handleRollback() {
    if (!selectedRecord || !rollbackReason.trim()) return
    try {
      const updated = await rollbackRecord(selectedRecord.id, rollbackReason, currentRole)
      await updateRecord(updated as RecordDetail)
      await refreshReport()
      setRollbackReason('')
      setShowRollback(false)
      await loadRecords()
      await loadDetail(selectedRecord.id)
    } catch (e: any) {
      alert('回滚失败：' + (e.message || e))
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!selectedRecord) return
    const file = e.target.files?.[0]
    if (!file) return
    try {
      await uploadPhoto(selectedRecord.id, file, photoDescription || undefined)
      setPhotoDescription('')
      await loadDetail(selectedRecord.id)
    } catch (e: any) {
      alert(e.message)
    }
  }

  const displayValue = (r: RecordDetail) => r.correctedValue ?? r.temperatureValue
  const displayUnit = (r: RecordDetail) => r.correctedUnit ?? r.temperatureUnit
  const operatorRoleLabel = (role: string) => roleMap[role] || role

  const filteredRecords = credibilityFilter
    ? records.filter(r => r.credibility === credibilityFilter)
    : records

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">复核工作台</h2>
          <p className="text-slate-500 text-sm mt-1">维修师傅老岑补看工况照片 → 训练教练复核确认</p>
        </div>
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
          <ClipboardCheck className="text-amber-600" size={18} />
          <span className="text-amber-700 text-sm">
            待复核记录: <strong>{filteredRecords.length}</strong> 条
          </span>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-7">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-sm px-3 py-1.5 border border-slate-300 rounded-md"
              >
                <option value="">全部状态</option>
                <option value="mixed_unit">混用待复核</option>
                <option value="normal">正常</option>
                <option value="confirmed">已确认</option>
                <option value="rolled_back">已回滚</option>
              </select>
              <select
                value={credibilityFilter}
                onChange={(e) => setCredibilityFilter(e.target.value)}
                className="text-sm px-3 py-1.5 border border-slate-300 rounded-md"
              >
                <option value="">全部可信度</option>
                <option value="sensor_trusted">传感器可信</option>
                <option value="photo_trusted">照片可信</option>
                <option value="pending_confirmation">待确认</option>
              </select>
            </div>
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-medium text-slate-500">行号</th>
                    <th className="px-3 py-2.5 text-left font-medium text-slate-500">传感器编号</th>
                    <th className="px-3 py-2.5 text-right font-medium text-slate-500">温度</th>
                    <th className="px-3 py-2.5 text-left font-medium text-slate-500">状态</th>
                    <th className="px-3 py-2.5 text-left font-medium text-slate-500">可信度</th>
                    <th className="px-3 py-2.5 text-left font-medium text-slate-500">来源</th>
                    <th className="px-3 py-2.5 text-center font-medium text-slate-500">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRecords.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => setSelectedRecord(r)}
                      className={cn(
                        'cursor-pointer transition-colors',
                        r.status === 'mixed_unit' ? 'bg-amber-50/40' : '',
                        selectedRecord?.id === r.id ? 'bg-emerald-50' : 'hover:bg-slate-50'
                      )}
                    >
                      <td className="px-3 py-2.5 font-mono text-slate-400">{r.originalLineNo}</td>
                      <td className="px-3 py-2.5 font-mono text-slate-900">{r.sensorId}</td>
                      <td className="px-3 py-2.5 font-mono text-right text-slate-900">
                        {displayValue(r)} <UnitBadge unit={displayUnit(r)} />
                      </td>
                      <td className="px-3 py-2.5"><StatusBadge status={r.status} /></td>
                      <td className="px-3 py-2.5"><CredibilityBadge credibility={r.credibility} /></td>
                      <td className="px-3 py-2.5"><SourceBadge source={r.source} /></td>
                      <td className="px-3 py-2.5 text-center">
                        <button className="text-emerald-600 hover:text-emerald-800">
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="col-span-5 space-y-4">
          {selectedRecord ? (
            <>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900">记录详情 #{selectedRecord.originalLineNo}</h3>
                  <button
                    onClick={() => setSelectedRecord(null)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">传感器编号</p>
                      <p className="font-mono font-semibold text-slate-900">{selectedRecord.sensorId}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">原始行号</p>
                      <p className="font-mono text-slate-900">{selectedRecord.originalLineNo}</p>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-4 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">原始值</p>
                      <p className="font-mono text-lg text-slate-900">
                        {selectedRecord.temperatureValue} <UnitBadge unit={selectedRecord.temperatureUnit} />
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">当前值</p>
                      <p className="font-mono text-lg text-slate-900">
                        {displayValue(selectedRecord)} <UnitBadge unit={displayUnit(selectedRecord)} />
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <StatusBadge status={selectedRecord.status} />
                    <CredibilityBadge credibility={selectedRecord.credibility} />
                    <SourceBadge source={selectedRecord.source} />
                  </div>

                  <NextStepPanel record={selectedRecord} />

                  <div>
                    <p className="text-xs text-slate-500 mb-1">工况照片</p>
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      {photos.map((p) => (
                        <div key={p.id} className="relative">
                          <img
                            src={`/${p.filePath}`}
                            alt={p.description || '工况照片'}
                            className="w-full h-16 object-cover rounded cursor-pointer border border-slate-200"
                            onClick={() => setPhotoPreview(`/${p.filePath}`)}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="file"
                        accept="image/*"
                        id="photo-upload"
                        className="hidden"
                        onChange={handlePhotoUpload}
                      />
                      <input
                        type="text"
                        placeholder="照片描述"
                        value={photoDescription}
                        onChange={(e) => setPhotoDescription(e.target.value)}
                        className="flex-1 text-sm px-3 py-1.5 border border-slate-300 rounded"
                      />
                      <label
                        htmlFor="photo-upload"
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded cursor-pointer flex items-center gap-1"
                      >
                        <Camera size={14} />
                        上传
                      </label>
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-slate-200 pt-4">
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">备注</label>
                      <textarea
                        value={noteValue}
                        onChange={(e) => setNoteValue(e.target.value)}
                        placeholder="输入备注..."
                        className="w-full text-sm px-3 py-2 border border-slate-300 rounded resize-none"
                        rows={2}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => handleReview('sensor_trusted')}
                        className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded flex items-center justify-center gap-1 transition-colors"
                      >
                        <CheckCircle size={14} />
                        传感器可信
                      </button>
                      <button
                        onClick={() => {
                          if (correctedValue) handleReview('photo_trusted')
                          else alert('请输入修正温度值')
                        }}
                        className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded flex items-center justify-center gap-1 transition-colors"
                      >
                        <Image size={14} />
                        照片可信
                      </button>
                      <button
                        onClick={() => handleReview('pending_confirmation')}
                        className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm rounded flex items-center justify-center gap-1 transition-colors"
                      >
                        待确认
                      </button>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.01"
                        placeholder="修正温度值"
                        value={correctedValue}
                        onChange={(e) => setCorrectedValue(e.target.value)}
                        className="flex-1 text-sm px-3 py-1.5 border border-slate-300 rounded"
                      />
                      <select
                        value={correctedUnit}
                        onChange={(e) => setCorrectedUnit(e.target.value as 'C' | 'K')}
                        className="w-20 text-sm px-2 py-1.5 border border-slate-300 rounded"
                      >
                        <option value="C">°C</option>
                        <option value="K">K</option>
                      </select>
                    </div>

                    <div className="flex gap-2">
                      {currentRole === 'training_coach' && selectedRecord.status !== 'confirmed' && (
                        <button
                          onClick={handleConfirm}
                          className="flex-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded flex items-center justify-center gap-1 transition-colors"
                        >
                          <CheckCircle size={14} />
                          教练确认
                        </button>
                      )}
                      {currentRole === 'training_coach' && (
                        <button
                          onClick={() => setShowRollback(!showRollback)}
                          className="px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 text-sm rounded flex items-center justify-center gap-1 transition-colors"
                        >
                          <RotateCcw size={14} />
                          回滚
                        </button>
                      )}
                    </div>

                    {showRollback && (
                      <div className="bg-red-50 border border-red-200 rounded p-3">
                        <textarea
                          value={rollbackReason}
                          onChange={(e) => setRollbackReason(e.target.value)}
                          placeholder="回滚原因（必填）"
                          className="w-full text-sm px-3 py-2 border border-red-300 rounded mb-2 resize-none"
                          rows={2}
                        />
                        <button
                          onClick={handleRollback}
                          disabled={!rollbackReason.trim()}
                          className="w-full px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white text-sm rounded transition-colors"
                        >
                          确认回滚至原始值
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-2">
                  <History size={16} className="text-slate-500" />
                  <h3 className="font-semibold text-slate-900 text-sm">审计日志</h3>
                </div>
                <div className="p-4 max-h-60 overflow-y-auto">
                  <div className="space-y-3">
                    {auditLogs.map((log, idx) => (
                      <div key={log.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs text-slate-600 font-medium">
                            {operatorRoleLabel(log.operatorRole).charAt(0)}
                          </div>
                          {idx < auditLogs.length - 1 && <div className="w-px h-full bg-slate-200 mt-1" />}
                        </div>
                        <div className="flex-1 pb-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-slate-900">{operatorRoleLabel(log.operatorRole)}</span>
                            <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded">{actionMap[log.action] || log.action}</span>
                            <span className="text-xs text-slate-400 ml-auto">{new Date(log.createdAt).toLocaleString('zh-CN')}</span>
                          </div>
                          {log.oldValue && (
                            <div className="text-xs font-mono">
                              <span className="text-red-500 line-through">{log.oldValue}</span>
                              <span className="text-slate-400 mx-2">→</span>
                              <span className="text-emerald-600">{log.newValue}</span>
                            </div>
                          )}
                          {log.note && (
                            <p className="text-xs text-slate-500 mt-1">备注：{log.note}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 text-center">
              <ClipboardCheck size={40} className="text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">点击左侧列表中的记录进行复核</p>
            </div>
          )}
        </div>
      </div>

      {photoPreview && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
          onClick={() => setPhotoPreview(null)}
        >
          <img src={photoPreview} alt="预览" className="max-w-[90vw] max-h-[90vh] rounded" />
          <button
            onClick={() => setPhotoPreview(null)}
            className="absolute top-4 right-4 text-white hover:text-slate-300"
          >
            <X size={24} />
          </button>
        </div>
      )}
    </div>
  )
}

function NextStepPanel({ record }: { record: RecordDetail }) {
  const { text, action, iconClass, bgClass, borderClass, owner } = (() => {
    if (record.status === 'confirmed') {
      return {
        text: '训练教练已确认，记录完成，可纳入交接报告。',
        action: '无待办',
        iconClass: 'text-emerald-700',
        bgClass: 'bg-emerald-50',
        borderClass: 'border-emerald-200',
        owner: '—',
      }
    }
    if (record.status === 'rolled_back') {
      return {
        text: '已回滚至传感器原始值。如需重新确认，请训练教练重新处理。',
        action: '请训练教练复核',
        iconClass: 'text-slate-700',
        bgClass: 'bg-slate-50',
        borderClass: 'border-slate-200',
        owner: '训练教练',
      }
    }
    if (record.correctedValue !== null && record.credibility === 'photo_trusted') {
      return {
        text: '维修师傅已通过工况照片补看，标记为照片可信。请训练教练查看修正结果并确认。',
        action: '等待训练教练确认',
        iconClass: 'text-indigo-700',
        bgClass: 'bg-indigo-50',
        borderClass: 'border-indigo-200',
        owner: '训练教练',
      }
    }
    if (record.status === 'mixed_unit' || record.credibility === 'pending_confirmation') {
      return {
        text: '同一传感器编号存在摄氏度/开尔文混用，请维修师傅先补看工况照片，再交由训练教练复核。',
        action: '① 维修师傅补看照片 → ② 训练教练复核确认',
        iconClass: 'text-amber-700',
        bgClass: 'bg-amber-50',
        borderClass: 'border-amber-200',
        owner: '维修师傅 → 训练教练',
      }
    }
    if (record.status === 'anomaly') {
      return {
        text: '已做修正，请训练教练复核后确认或回滚。',
        action: '请训练教练复核确认',
        iconClass: 'text-orange-700',
        bgClass: 'bg-orange-50',
        borderClass: 'border-orange-200',
        owner: '训练教练',
      }
    }
    return {
      text: '数据正常，单位一致，无需额外处理。',
      action: '无需处理',
      iconClass: 'text-emerald-700',
      bgClass: 'bg-emerald-50',
      borderClass: 'border-emerald-200',
      owner: '—',
    }
  })()

  return (
    <div className={`${bgClass} ${borderClass} border rounded-lg p-3`}>
      <div className="flex items-start gap-2">
        <UserCheck size={16} className={`mt-0.5 ${iconClass} flex-shrink-0`} />
        <div className="flex-1 text-xs">
          <p className={`font-semibold mb-1 ${iconClass} flex items-center gap-1`}>
            <Shield size={12} />
            下一步处理
            {owner !== '—' && (
              <span className="ml-auto font-mono font-normal bg-white/60 px-1.5 py-0.5 rounded border border-current/20">
                负责人：{owner}
              </span>
            )}
          </p>
          <p className="text-slate-700 leading-relaxed mb-1">{text}</p>
          <p className="font-mono text-[11px] text-slate-500 flex items-center gap-1">
            <ArrowRight size={10} />
            {action}
          </p>
        </div>
      </div>
    </div>
  )
}
