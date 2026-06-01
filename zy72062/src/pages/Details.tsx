import { useState, useMemo } from 'react'
import { useStore } from '@/store/useStore'
import type { AnomalyType, Entity } from '@/types'
import { Search, X, FileText, Merge } from 'lucide-react'

const ANOMALY_LABELS: Record<AnomalyType, string> = {
  coordinate_offset: '坐标偏移',
  duplicate_name: '重名',
  missing_photo: '缺照片',
  cross_floor: '跨楼层',
}

const ANOMALY_COLORS: Record<AnomalyType, string> = {
  coordinate_offset: '#3ec9c2',
  duplicate_name: '#d4a543',
  missing_photo: '#e8634f',
  cross_floor: '#a78bfa',
}

const FILTER_OPTIONS: { label: string; value: AnomalyType | null }[] = [
  { label: '全部', value: null },
  { label: '坐标偏移', value: 'coordinate_offset' },
  { label: '重名', value: 'duplicate_name' },
  { label: '缺照片', value: 'missing_photo' },
  { label: '跨楼层', value: 'cross_floor' },
]

export default function Details() {
  const entities = useStore((s) => s.entities)
  const anomalies = useStore((s) => s.anomalies)
  const supplements = useStore((s) => s.supplements)
  const selectedEntityId = useStore((s) => s.selectedEntityId)
  const anomalyFilter = useStore((s) => s.anomalyFilter)
  const setSelectedEntityId = useStore((s) => s.setSelectedEntityId)
  const setAnomalyFilter = useStore((s) => s.setAnomalyFilter)
  const updateEntity = useStore((s) => s.updateEntity)
  const addSupplement = useStore((s) => s.addSupplement)
  const mergeEntities = useStore((s) => s.mergeEntities)

  const [search, setSearch] = useState('')
  const [form, setForm] = useState<Partial<Entity>>({})
  const [supplementOpen, setSupplementOpen] = useState(false)
  const [supplementText, setSupplementText] = useState('')
  const [mergeTarget, setMergeTarget] = useState<{ left: Entity; right: Entity } | null>(null)

  const entityAnomalyMap = useMemo(() => {
    const m = new Map<string, AnomalyType[]>()
    anomalies.forEach((a) => {
      const list = m.get(a.entityId) ?? []
      if (!list.includes(a.type)) list.push(a.type)
      m.set(a.entityId, list)
    })
    return m
  }, [anomalies])

  const filtered = useMemo(() => {
    let list = entities
    if (anomalyFilter) {
      const ids = new Set(anomalies.filter((a) => a.type === anomalyFilter).map((a) => a.entityId))
      list = list.filter((e) => ids.has(e.id))
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((e) => e.name.toLowerCase().includes(q))
    }
    return list
  }, [entities, anomalies, anomalyFilter, search])

  const selectedEntity = entities.find((e) => e.id === selectedEntityId) ?? null
  const entitySupplements = supplements.filter((s) => s.entityId === selectedEntityId)

  const openPanel = (entity: Entity) => {
    setSelectedEntityId(entity.id)
    setForm({
      name: entity.name,
      shareRatio: entity.shareRatio,
      x: entity.x,
      y: entity.y,
      floor: entity.floor,
      notes: entity.notes,
    })
  }

  const closePanel = () => {
    setSelectedEntityId(null)
    setForm({})
  }

  const handleSave = () => {
    if (!selectedEntityId) return
    updateEntity(selectedEntityId, {
      name: form.name,
      shareRatio: form.shareRatio,
      x: form.x,
      y: form.y,
      floor: form.floor,
      notes: form.notes,
    })
  }

  const handleSupplement = () => {
    if (!selectedEntity || !supplementText.trim()) return
    const diff = form.notes
      ? form.notes + '\n⟫' + supplementText.trim()
      : '⟫' + supplementText.trim()
    addSupplement({
      entityId: selectedEntity.id,
      originalContent: form.notes ?? '',
      supplementedContent: supplementText.trim(),
      diff,
      supplementTime: new Date().toISOString(),
    })
    updateEntity(selectedEntity.id, { notes: diff })
    setSupplementOpen(false)
    setSupplementText('')
  }

  const openMerge = (entity: Entity) => {
    const dupAnomaly = anomalies.find(
      (a) => a.entityId === entity.id && a.type === 'duplicate_name'
    )
    if (!dupAnomaly) return
    const dupEntities = entities.filter(
      (e) => e.id !== entity.id && e.name === entity.name
    )
    if (dupEntities.length > 0) {
      setMergeTarget({ left: entity, right: dupEntities[0] })
    }
  }

  const handleMerge = (direction: 'left' | 'right') => {
    if (!mergeTarget) return
    if (direction === 'left') {
      mergeEntities(mergeTarget.right.id, mergeTarget.left.id)
    } else {
      mergeEntities(mergeTarget.left.id, mergeTarget.right.id)
    }
    setMergeTarget(null)
    if (selectedEntityId === mergeTarget.left.id || selectedEntityId === mergeTarget.right.id) {
      closePanel()
    }
  }

  return (
    <div className="flex h-full" style={{ background: '#0f1219' }}>
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-3 px-5 py-3 border-b" style={{ borderColor: '#2a2f3e' }}>
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              onClick={() => setAnomalyFilter(opt.value)}
              className="px-3 py-1.5 rounded text-sm font-medium transition-colors"
              style={{
                background: anomalyFilter === opt.value ? (opt.value ? ANOMALY_COLORS[opt.value] + '22' : '#d4a54322') : 'transparent',
                color: anomalyFilter === opt.value ? (opt.value ? ANOMALY_COLORS[opt.value] : '#d4a543') : '#8892a4',
                border: anomalyFilter === opt.value ? `1px solid ${opt.value ? ANOMALY_COLORS[opt.value] + '55' : '#d4a54355'}` : '1px solid transparent',
              }}
            >
              {opt.label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded" style={{ background: '#1a1f2e' }}>
            <Search size={14} style={{ color: '#8892a4' }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索实体名称..."
              className="bg-transparent text-sm outline-none w-40"
              style={{ color: '#c8cdd8' }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#1a1f2e' }}>
                {['名称', '持股比例', '坐标系', '坐标(X,Y)', '楼层', '照片', '来源', '操作'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left font-medium" style={{ color: '#8892a4' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((entity) => {
                const types = entityAnomalyMap.get(entity.id) ?? []
                const isSelected = entity.id === selectedEntityId
                return (
                  <tr
                    key={entity.id}
                    onClick={() => openPanel(entity)}
                    className="cursor-pointer transition-colors"
                    style={{
                      background: isSelected ? '#1a1f2e' : 'transparent',
                      borderLeft: types.length > 0 ? `3px solid ${ANOMALY_COLORS[types[0]]}` : '3px solid transparent',
                    }}
                  >
                    <td className="px-4 py-2.5 flex items-center gap-2" style={{ color: '#e2e6ef' }}>
                      {entity.name}
                      {types.map((t) => (
                        <span
                          key={t}
                          className="text-xs px-1.5 py-0.5 rounded"
                          style={{ background: ANOMALY_COLORS[t] + '22', color: ANOMALY_COLORS[t] }}
                        >
                          {ANOMALY_LABELS[t]}
                        </span>
                      ))}
                    </td>
                    <td className="px-4 py-2.5" style={{ color: '#c8cdd8' }}>{entity.shareRatio}%</td>
                    <td className="px-4 py-2.5" style={{ color: '#c8cdd8' }}>{entity.coordinateSystem}</td>
                    <td className="px-4 py-2.5" style={{ color: '#c8cdd8' }}>({entity.x.toFixed(1)}, {entity.y.toFixed(1)})</td>
                    <td className="px-4 py-2.5" style={{ color: '#c8cdd8' }}>{entity.floor}F</td>
                    <td className="px-4 py-2.5" style={{ color: entity.photoUrl ? '#3ec9c2' : '#e8634f' }}>
                      {entity.photoUrl ? '✓' : '✗'}
                    </td>
                    <td className="px-4 py-2.5" style={{ color: '#8892a4' }}>{entity.sourceFile}</td>
                    <td className="px-4 py-2.5">
                      {types.includes('duplicate_name') && (
                        <button
                          onClick={(e) => { e.stopPropagation(); openMerge(entity) }}
                          className="px-2 py-1 rounded text-xs"
                          style={{ background: '#d4a54322', color: '#d4a543' }}
                        >
                          <Merge size={12} className="inline mr-1" />合并
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-10" style={{ color: '#8892a4' }}>
                    暂无数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedEntity && (
        <div
          className="w-80 flex-shrink-0 flex flex-col border-l overflow-auto"
          style={{ background: '#1a1f2e', borderColor: '#2a2f3e' }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#2a2f3e' }}>
            <span className="font-medium" style={{ color: '#e2e6ef' }}>参数编辑</span>
            <button onClick={closePanel}><X size={16} style={{ color: '#8892a4' }} /></button>
          </div>

          <div className="flex-1 px-4 py-3 space-y-3">
            {([
              ['名称', 'name', form.name ?? ''],
              ['持股比例', 'shareRatio', form.shareRatio ?? 0],
              ['X坐标', 'x', form.x ?? 0],
              ['Y坐标', 'y', form.y ?? 0],
              ['楼层', 'floor', form.floor ?? 1],
              ['备注', 'notes', form.notes ?? ''],
            ] as const).map(([label, key, val]) => (
              <div key={key}>
                <label className="block text-xs mb-1" style={{ color: '#8892a4' }}>{label}</label>
                <input
                  value={val}
                  onChange={(e) => {
                    const v = (key === 'shareRatio' || key === 'x' || key === 'y' || key === 'floor')
                      ? Number(e.target.value) : e.target.value
                    setForm((f) => ({ ...f, [key]: v }))
                  }}
                  className="w-full px-3 py-1.5 rounded text-sm outline-none"
                  style={{ background: '#0f1219', color: '#c8cdd8', border: '1px solid #2a2f3e' }}
                />
              </div>
            ))}

            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSave}
                className="flex-1 py-1.5 rounded text-sm font-medium"
                style={{ background: '#d4a543', color: '#0f1219' }}
              >保存</button>
              <button
                onClick={() => setSupplementOpen(true)}
                className="flex-1 py-1.5 rounded text-sm font-medium flex items-center justify-center gap-1"
                style={{ background: '#3ec9c222', color: '#3ec9c2', border: '1px solid #3ec9c244' }}
              >
                <FileText size={13} />增补备注
              </button>
            </div>

            <div className="pt-3 space-y-1 text-xs" style={{ color: '#8892a4' }}>
              <p>来源文件: {selectedEntity.sourceFile}</p>
              <p>导入时间: {selectedEntity.importTime}</p>
              <p>处理时间: {selectedEntity.processTime}</p>
            </div>

            {entitySupplements.length > 0 && (
              <div className="pt-3">
                <p className="text-xs font-medium mb-2" style={{ color: '#8892a4' }}>增补记录</p>
                {entitySupplements.map((s) => (
                  <div key={s.id} className="mb-2 p-2 rounded text-xs" style={{ background: '#0f1219' }}>
                    <p style={{ color: '#3ec9c2' }}>{s.supplementedContent}</p>
                    <p className="mt-1" style={{ color: '#5a6478' }}>{s.supplementTime}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {supplementOpen && selectedEntity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="w-[600px] rounded-lg p-5" style={{ background: '#1a1f2e' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium" style={{ color: '#e2e6ef' }}>增补备注</h3>
              <button onClick={() => { setSupplementOpen(false); setSupplementText('') }}><X size={16} style={{ color: '#8892a4' }} /></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs mb-1" style={{ color: '#8892a4' }}>原始内容</p>
                <div className="p-3 rounded text-sm min-h-[120px]" style={{ background: '#0f1219', color: '#c8cdd8' }}>
                  {form.notes || '（空）'}
                </div>
              </div>
              <div>
                <p className="text-xs mb-1" style={{ color: '#8892a4' }}>增补内容</p>
                <textarea
                  value={supplementText}
                  onChange={(e) => setSupplementText(e.target.value)}
                  className="w-full p-3 rounded text-sm outline-none resize-none min-h-[120px]"
                  style={{ background: '#0f1219', color: '#c8cdd8', border: '1px solid #2a2f3e' }}
                  placeholder="输入增补内容..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => { setSupplementOpen(false); setSupplementText('') }}
                className="px-4 py-1.5 rounded text-sm"
                style={{ color: '#8892a4', border: '1px solid #2a2f3e' }}
              >取消</button>
              <button
                onClick={handleSupplement}
                className="px-4 py-1.5 rounded text-sm font-medium"
                style={{ background: '#3ec9c2', color: '#0f1219' }}
              >确认增补</button>
            </div>
          </div>
        </div>
      )}

      {mergeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="w-[480px] rounded-lg p-5" style={{ background: '#1a1f2e' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium" style={{ color: '#e2e6ef' }}>合并重名实体</h3>
              <button onClick={() => setMergeTarget(null)}><X size={16} style={{ color: '#8892a4' }} /></button>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1 p-3 rounded text-center" style={{ background: '#0f1219' }}>
                <p className="text-sm font-medium" style={{ color: '#d4a543' }}>{mergeTarget.left.name}</p>
                <p className="text-xs mt-1" style={{ color: '#8892a4' }}>ID: {mergeTarget.left.id.slice(0, 8)}</p>
              </div>
              <Merge size={20} style={{ color: '#8892a4' }} />
              <div className="flex-1 p-3 rounded text-center" style={{ background: '#0f1219' }}>
                <p className="text-sm font-medium" style={{ color: '#d4a543' }}>{mergeTarget.right.name}</p>
                <p className="text-xs mt-1" style={{ color: '#8892a4' }}>ID: {mergeTarget.right.id.slice(0, 8)}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setMergeTarget(null)}
                className="px-4 py-1.5 rounded text-sm"
                style={{ color: '#8892a4', border: '1px solid #2a2f3e' }}
              >取消</button>
              <button
                onClick={() => handleMerge('left')}
                className="px-4 py-1.5 rounded text-sm font-medium"
                style={{ background: '#d4a543', color: '#0f1219' }}
              >合并到左</button>
              <button
                onClick={() => handleMerge('right')}
                className="px-4 py-1.5 rounded text-sm font-medium"
                style={{ background: '#d4a543', color: '#0f1219' }}
              >合并到右</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
