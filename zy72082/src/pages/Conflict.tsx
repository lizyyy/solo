import { useState } from 'react'
import { useStore } from '@/store'
import { CONFLICT_TYPE_LABELS } from '@/types'
import type { Conflict } from '@/types'
import { Shield, Search, Clock, Swords, ChevronRight, Send } from 'lucide-react'

type Side = 'historical' | 'imported' | 'manual'

export default function ConflictPage() {
  const { conflicts, resolutions, records, dataSources, detectConflicts, resolveConflict } = useStore()
  const [activeId, setActiveId] = useState<number | null>(null)
  const [chosenSide, setChosenSide] = useState<Side | null>(null)
  const [manualValue, setManualValue] = useState('')
  const [reason, setReason] = useState('')
  const [detecting, setDetecting] = useState(false)

  const pending = conflicts.filter((c) => c.status === 'pending')
  const resolved = conflicts.filter((c) => c.status === 'resolved')

  const handleDetect = async () => {
    setDetecting(true)
    await detectConflicts()
    setDetecting(false)
  }

  const handleSubmit = async (conflict: Conflict) => {
    if (!chosenSide || !reason) return
    await resolveConflict(conflict.id!, {
      conflictId: conflict.id!,
      chosenSide,
      manualValue: chosenSide === 'manual' ? manualValue : undefined,
      reason,
      resolvedBy: '当前用户',
      resolvedAt: new Date().toISOString(),
    })
    setActiveId(null)
    setChosenSide(null)
    setManualValue('')
    setReason('')
  }

  const getRecord = (id: number) => records.find((r) => r.id === id)
  const getSource = (dsId: number) => dataSources.find((d) => d.id === dsId)
  const getSourceLabel = (dsId: number) => {
    const ds = getSource(dsId)
    return ds?.type === 'lecture' ? '老师讲义' : ds?.type === 'business_table' ? '业务表' : ds?.type === 'screenshot' ? '截图' : '手动录入'
  }
  const isHistorical = (dsId: number) => {
    const ds = getSource(dsId)
    return ds?.type === 'lecture' || ds?.type === 'business_table'
  }

  const getResolution = (conflictId: number) => resolutions.find((r) => r.conflictId === conflictId)

  const sideLabel = (s: string) => s === 'historical' ? '采用历史' : s === 'imported' ? '采用新数据' : '人工裁决'

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title flex items-center gap-2">
            <Shield className="w-5 h-5 text-teal-600" />
            冲突检测
          </h2>
          <button onClick={handleDetect} disabled={detecting} className="btn-primary flex items-center gap-2">
            <Search className="w-4 h-4" />
            {detecting ? '检测中...' : '检测冲突'}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-teal-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-teal-800">{conflicts.length}</div>
            <div className="text-sm text-teal-600">总冲突</div>
          </div>
          <div className="bg-amber-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-amber-600">{pending.length}</div>
            <div className="text-sm text-amber-500">待裁决</div>
          </div>
          <div className="bg-teal-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-teal-600">{resolved.length}</div>
            <div className="text-sm text-teal-600">已解决</div>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="section-title flex items-center gap-2 mb-4">
          <Swords className="w-5 h-5 text-amber-600" />
          待裁决冲突列表
        </h2>
        {pending.length === 0 ? (
          <p className="text-navy-800/50 text-center py-8">暂无待裁决冲突</p>
        ) : (
          <div className="space-y-4">
            {pending.map((conflict) => {
              const isActive = activeId === conflict.id
              const hRec = getRecord(conflict.historicalRecordId)
              const iRec = getRecord(conflict.importedRecordId)
              const hSourceLabel = hRec ? getSourceLabel(hRec.dataSourceId) : '历史'
              const iSourceLabel = iRec ? getSourceLabel(iRec.dataSourceId) : '导入'
              const hIsHist = hRec ? isHistorical(hRec.dataSourceId) : true
              const iIsHist = iRec ? isHistorical(iRec.dataSourceId) : false

              return (
                <div key={conflict.id} className="border border-teal-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => { setActiveId(isActive ? null : conflict.id!); setChosenSide(null); setManualValue(''); setReason('') }}
                    className="w-full flex items-center justify-between p-4 bg-teal-50/50 hover:bg-teal-100/50 transition"
                  >
                    <div className="flex items-center gap-3">
                      <span className="badge-danger text-xs">{CONFLICT_TYPE_LABELS[conflict.conflictType]}</span>
                      <span className="text-sm font-medium text-navy-900">字段: {conflict.fieldName}</span>
                    </div>
                    <ChevronRight className={`w-4 h-4 text-teal-600 transition ${isActive ? 'rotate-90' : ''}`} />
                  </button>

                  {isActive && (
                    <div className="p-4 space-y-4">
                      <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-stretch">
                        <div className={`rounded-lg p-4 ${hIsHist ? 'bg-teal-50 border border-teal-200' : 'bg-amber-50 border border-amber-200'}`}>
                          <span className={`text-xs px-2 py-0.5 rounded ${hIsHist ? 'badge-info' : 'badge-warning'}`}>{hSourceLabel}</span>
                          <div className="mt-2 text-sm text-navy-800/60">历史数据</div>
                          <div className="text-xl font-bold text-navy-900 mt-1">{conflict.historicalValue}</div>
                        </div>

                        <div className="flex flex-col items-center justify-center gap-1">
                          <span className="badge-danger text-xs font-bold">VS</span>
                          <span className="text-xs text-navy-800/40">{CONFLICT_TYPE_LABELS[conflict.conflictType]}</span>
                        </div>

                        <div className={`rounded-lg p-4 ${iIsHist ? 'bg-teal-50 border border-teal-200' : 'bg-amber-50 border border-amber-200'}`}>
                          <span className={`text-xs px-2 py-0.5 rounded ${iIsHist ? 'badge-info' : 'badge-warning'}`}>{iSourceLabel}</span>
                          <div className="mt-2 text-sm text-navy-800/60">导入数据</div>
                          <div className="text-xl font-bold text-navy-900 mt-1">{conflict.importedValue}</div>
                        </div>
                      </div>

                      <div className="flex gap-2 justify-center">
                        <button onClick={() => setChosenSide('historical')} className={`btn-secondary ${chosenSide === 'historical' ? 'ring-2 ring-teal-600' : ''}`}>采用历史</button>
                        <button onClick={() => setChosenSide('imported')} className={`btn-secondary ${chosenSide === 'imported' ? 'ring-2 ring-teal-600' : ''}`}>采用新数据</button>
                        <button onClick={() => setChosenSide('manual')} className={`btn-secondary ${chosenSide === 'manual' ? 'ring-2 ring-teal-600' : ''}`}>人工裁决</button>
                      </div>

                      {chosenSide === 'manual' && (
                        <div>
                          <label className="label-text">人工输入值</label>
                          <input value={manualValue} onChange={(e) => setManualValue(e.target.value)} className="input-field" placeholder="请输入裁决值" />
                        </div>
                      )}

                      {chosenSide && (
                        <div className="space-y-3">
                          <div>
                            <label className="label-text">裁决理由</label>
                            <input value={reason} onChange={(e) => setReason(e.target.value)} className="input-field" placeholder="请输入理由" />
                          </div>
                          <button onClick={() => handleSubmit(conflict)} disabled={!reason} className="btn-primary flex items-center gap-2 mx-auto">
                            <Send className="w-4 h-4" />
                            提交裁决
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="card p-6">
        <h2 className="section-title flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-teal-600" />
          裁决历史时间线
        </h2>
        {resolved.length === 0 ? (
          <p className="text-navy-800/50 text-center py-8">暂无裁决历史</p>
        ) : (
          <div className="relative pl-6">
            <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-teal-200" />
            <div className="space-y-6">
              {resolved.map((conflict) => {
                const res = getResolution(conflict.id!)
                return (
                  <div key={conflict.id} className="relative">
                    <div className="absolute -left-4 top-1 w-4 h-4 rounded-full bg-teal-600 border-2 border-white" />
                    <div className="bg-teal-50/50 rounded-lg p-4 border border-teal-100">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs text-navy-800/50">{res?.resolvedAt ? new Date(res.resolvedAt).toLocaleString('zh-CN') : '--'}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${res?.chosenSide === 'manual' ? 'badge-warning' : 'badge-success'}`}>
                          {res ? sideLabel(res.chosenSide) : '--'}
                        </span>
                        <span className="badge-info text-xs">{CONFLICT_TYPE_LABELS[conflict.conflictType]}</span>
                      </div>
                      <div className="text-sm text-navy-900">
                        <span className="font-medium">{conflict.fieldName}</span>：
                        <span className="line-through text-navy-800/40 mr-2">{conflict.historicalValue}</span>
                        →
                        <span className="font-bold text-teal-700 ml-2">{res?.chosenSide === 'manual' ? res.manualValue : res?.chosenSide === 'imported' ? conflict.importedValue : conflict.historicalValue}</span>
                      </div>
                      {res?.reason && <div className="text-sm text-navy-800/60 mt-1">理由：{res.reason}</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
