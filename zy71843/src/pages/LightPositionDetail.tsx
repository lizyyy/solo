import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, ChevronDown, ChevronUp, Edit3, Check, X, AlertTriangle } from 'lucide-react'
import { useStore } from '@/store/useStore'
import {
  STATUS_LABELS,
  CHANGE_TYPE_LABELS,
  SOURCE_LABELS,
  ANOMALY_CATEGORY_LABELS,
} from '@/types'
import type { PositionStatus, SourceType, ChangeType } from '@/types'

const STATUS_BADGE: Record<PositionStatus, string> = {
  calibrated: 'bg-accent-green/20 text-accent-green',
  pending_material: 'bg-accent-amber/20 text-accent-amber',
  conclusion_changed: 'bg-blue-500/20 text-blue-400',
  anomaly: 'bg-accent-red/20 text-accent-red',
}

const SOURCE_BADGE: Record<SourceType, string> = {
  route: 'bg-purple-500/20 text-purple-300',
  equipment_note: 'bg-blue-500/20 text-blue-300',
  cad_manual: 'bg-orange-500/20 text-orange-300',
}

const CHANGE_BADGE: Record<ChangeType, string> = {
  material_supplement: 'bg-gray-500/20 text-gray-300',
  conclusion_change: 'bg-accent-amber/20 text-accent-amber',
  cad_manual_edit: 'bg-blue-500/20 text-blue-400',
}

export default function LightPositionDetail() {
  const { id: projectId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { projects, getProjectPositions, getPositionChanges, getPositionAnomalies, updatePosition, resolveAnomaly } = useStore()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editChangeType, setEditChangeType] = useState<ChangeType>('material_supplement')
  const [editReason, setEditReason] = useState('')
  const [duplicatesOpen, setDuplicatesOpen] = useState(false)
  const [routeOpen, setRouteOpen] = useState(false)

  const project = projects.find((p) => p.id === projectId)
  const positions = getProjectPositions(projectId!)
  const duplicates = positions.filter((p) => p.isDuplicate)
  const selected = positions.find((p) => p.id === selectedId)
  const changes = selectedId ? getPositionChanges(selectedId).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) : []
  const anomalies = selectedId ? getPositionAnomalies(selectedId) : []
  const routePositions = [...positions].sort((a, b) => (a.routeOrder ?? 999) - (b.routeOrder ?? 999))

  const startEdit = (posId: string, currentValue: string) => {
    setEditingId(posId)
    setEditValue(currentValue)
    setEditChangeType('material_supplement')
    setEditReason('')
  }

  const saveEdit = () => {
    if (!editingId) return
    updatePosition(editingId, { currentValue: editValue }, editChangeType, editReason)
    setEditingId(null)
  }

  const cancelEdit = () => setEditingId(null)

  const fmtDate = (iso: string) => {
    const d = new Date(iso)
    return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen bg-surface-900 text-gray-200 font-sans">
      <header className="sticky top-0 z-20 bg-surface-800 border-b border-surface-600 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="p-1.5 rounded hover:bg-surface-600 transition">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-semibold flex-1 truncate">{project?.name ?? '项目'}</h1>
          <button
            onClick={() => navigate(`/project/${projectId}/export`)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-amber/20 text-accent-amber rounded text-sm hover:bg-accent-amber/30 transition"
          >
            <Download size={15} /> 导出巡检单
          </button>
        </div>
        {duplicates.length > 0 && (
          <div className="mt-2 bg-accent-red/10 border border-accent-red/30 rounded px-3 py-2 text-sm">
            <button className="flex items-center gap-2 w-full text-accent-red" onClick={() => setDuplicatesOpen(!duplicatesOpen)}>
              <AlertTriangle size={15} />
              <span className="flex-1 text-left">{duplicates.length} 个灯位存在重复</span>
              {duplicatesOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
            {duplicatesOpen && (
              <ul className="mt-2 pl-7 space-y-1 text-gray-300">
                {duplicates.map((d) => <li key={d.id}>{d.code} - {d.location}</li>)}
              </ul>
            )}
          </div>
        )}
      </header>

      <div className="flex flex-col lg:flex-row gap-4 p-4">
        <div className="lg:w-[60%] overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-surface-600">
                <th className="text-left py-2 px-3 font-medium">编号</th>
                <th className="text-left py-2 px-3 font-medium">位置</th>
                <th className="text-left py-2 px-3 font-medium">状态</th>
                <th className="text-left py-2 px-3 font-medium">来源</th>
                <th className="text-left py-2 px-3 font-medium">当前值</th>
                <th className="text-left py-2 px-3 font-medium">最后修改</th>
                <th className="py-2 px-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {positions.map((pos) => (
                <tr
                  key={pos.id}
                  onClick={() => setSelectedId(pos.id)}
                  className={`border-b border-surface-700 cursor-pointer transition hover:bg-surface-700/50 ${selectedId === pos.id ? 'border-l-2 border-l-accent-amber bg-surface-700/30' : 'border-l-2 border-l-transparent'}`}
                >
                  <td className="py-2.5 px-3 font-mono text-accent-amber">{pos.code}</td>
                  <td className="py-2.5 px-3">{pos.location}</td>
                  <td className="py-2.5 px-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${STATUS_BADGE[pos.status]}`}>
                      {STATUS_LABELS[pos.status]}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={`px-1.5 py-0.5 rounded text-[11px] ${SOURCE_BADGE[pos.source]}`}>
                      {SOURCE_LABELS[pos.source]}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    {editingId === pos.id ? (
                      <div className="flex flex-col gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="bg-surface-600 border border-surface-600 rounded px-2 py-1 text-sm focus:border-accent-amber outline-none"
                        />
                        <select
                          value={editChangeType}
                          onChange={(e) => setEditChangeType(e.target.value as ChangeType)}
                          className="bg-surface-600 border border-surface-600 rounded px-2 py-1 text-sm focus:border-accent-amber outline-none"
                        >
                          <option value="material_supplement">补材料</option>
                          <option value="conclusion_change">改结论</option>
                          <option value="cad_manual_edit">CAD手工改动</option>
                        </select>
                        <input
                          value={editReason}
                          onChange={(e) => setEditReason(e.target.value)}
                          placeholder="修改原因"
                          className="bg-surface-600 border border-surface-600 rounded px-2 py-1 text-sm focus:border-accent-amber outline-none"
                        />
                        <div className="flex gap-1">
                          <button onClick={saveEdit} className="p-1 bg-accent-green/20 text-accent-green rounded hover:bg-accent-green/30"><Check size={14} /></button>
                          <button onClick={cancelEdit} className="p-1 bg-accent-red/20 text-accent-red rounded hover:bg-accent-red/30"><X size={14} /></button>
                        </div>
                      </div>
                    ) : (
                      <span className="font-mono text-xs">{pos.currentValue}</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-xs text-gray-400">{fmtDate(pos.lastModified)}</td>
                  <td className="py-2.5 px-3">
                    {editingId !== pos.id && (
                      <button
                        onClick={(e) => { e.stopPropagation(); startEdit(pos.id, pos.currentValue) }}
                        className="p-1 rounded hover:bg-surface-600 text-gray-400 hover:text-accent-amber transition"
                      >
                        <Edit3 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="lg:w-[40%] bg-surface-800 rounded-lg border border-surface-600 p-4 self-start">
          {selected ? (
            <>
              <h2 className="text-base font-semibold mb-4">
                变更历史 - <span className="text-accent-amber font-mono">{selected.code}</span>
              </h2>
              {changes.length === 0 ? (
                <p className="text-gray-500 text-sm">暂无变更记录</p>
              ) : (
                <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
                  {changes.map((rec) => (
                    <div key={rec.id} className="relative pl-4 border-l-2 border-surface-600 pb-3">
                      <div className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-surface-600" />
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-1.5 py-0.5 rounded text-[11px] ${CHANGE_BADGE[rec.type]}`}>
                          {CHANGE_TYPE_LABELS[rec.type]}
                        </span>
                        <span className="text-xs text-gray-500">{fmtDate(rec.timestamp)}</span>
                      </div>
                      <div className="text-sm mb-1">
                        <span className="text-accent-red line-through">{rec.previousValue}</span>
                        <span className="mx-1.5 text-gray-500">→</span>
                        <span className="text-accent-green">{rec.newValue}</span>
                      </div>
                      {rec.reason && <p className="text-xs text-gray-400">{rec.reason}</p>}
                    </div>
                  ))}
                </div>
              )}

              {anomalies.length > 0 && (
                <div className="mt-5 pt-4 border-t border-surface-600">
                  <h3 className="text-sm font-semibold text-accent-red mb-3">异常记录</h3>
                  <div className="space-y-2">
                    {anomalies.map((a) => (
                      <div key={a.id} className={`rounded p-2.5 text-sm ${a.resolved ? 'bg-surface-700/50 opacity-60' : 'bg-accent-red/5 border border-accent-red/20'}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-gray-300">{ANOMALY_CATEGORY_LABELS[a.category]}</span>
                          {a.resolved && <span className="text-[11px] bg-accent-green/20 text-accent-green px-1.5 py-0.5 rounded">已解决</span>}
                        </div>
                        <p className="text-gray-400 text-xs mb-1">{a.description}</p>
                        <p className="text-gray-500 text-xs">建议: {a.suggestion}</p>
                        {!a.resolved && (
                          <button
                            onClick={() => resolveAnomaly(a.id)}
                            className="mt-1.5 text-[11px] px-2 py-0.5 bg-accent-green/20 text-accent-green rounded hover:bg-accent-green/30 transition"
                          >
                            标记已解决
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-gray-500 text-sm text-center py-8">选择一个灯位查看变更历史</p>
          )}
        </div>
      </div>

      <div className="px-4 pb-4">
        <button
          onClick={() => setRouteOpen(!routeOpen)}
          className="flex items-center gap-2 px-3 py-2 bg-surface-800 rounded-t-lg border border-surface-600 text-sm text-gray-300 hover:bg-surface-700 transition"
        >
          讲解路线排序
          {routeOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
        {routeOpen && (
          <div className="bg-surface-800 border border-t-0 border-surface-600 rounded-b-lg p-3">
            <ol className="space-y-1.5">
              {routePositions.map((pos) => {
                const isEarly = pos.source === 'route' && pos.status === 'pending_material'
                return (
                  <li key={pos.id} className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500 w-6 text-right">{pos.routeOrder ?? '-'}.</span>
                    <span className="font-mono text-accent-amber">{pos.code}</span>
                    <span className="text-gray-400">- {pos.location}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[11px] ${STATUS_BADGE[pos.status]}`}>
                      {STATUS_LABELS[pos.status]}
                    </span>
                    {isEarly && <span className="w-2 h-2 rounded-full bg-accent-amber" />}
                  </li>
                )
              })}
            </ol>
          </div>
        )}
      </div>
    </div>
  )
}
