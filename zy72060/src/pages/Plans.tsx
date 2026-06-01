import { useState } from 'react'
import { useStore } from '@/store/useStore'
import { FolderOpen, Plus, Clock, User, AlertTriangle, Trash2, Download, Upload } from 'lucide-react'

export default function Plans() {
  const {
    plans,
    currentPlanId,
    setCurrentPlan,
    addPlan,
    deletePlan,
    updatePlan,
    points,
    traces,
    conflicts,
    cameraState,
    viewPreset,
    loadPlanData,
  } = useStore()

  const [newPlanName, setNewPlanName] = useState('')
  const [showNewPlan, setShowNewPlan] = useState(false)

  const handleCreatePlan = () => {
    if (!newPlanName.trim()) return
    const newPlan = {
      id: `plan-${Date.now()}`,
      name: newPlanName.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      creator: '当前用户',
      cameraState,
      viewPreset,
    }
    addPlan(newPlan)
    setCurrentPlan(newPlan.id)
    setNewPlanName('')
    setShowNewPlan(false)
  }

  const handleSaveCurrentPlan = () => {
    if (!currentPlanId) return
    updatePlan(currentPlanId, {
      cameraState,
      viewPreset,
    })
  }

  const handleExportPlan = (planId: string) => {
    const plan = plans.find((p) => p.id === planId)
    if (!plan) return
    const planPoints = points.filter((p) => p.planId === planId)
    const planTraces = traces.filter((t) => planPoints.some((p) => p.id === t.pointId))
    const planConflicts = conflicts.filter((c) => planPoints.some((p) => p.id === c.pointId))

    const exportData = {
      plan,
      points: planPoints,
      traces: planTraces,
      conflicts: planConflicts,
      exportedAt: new Date().toISOString(),
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${plan.name}.json`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const handleImportPlan = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string)
          if (data.plan) {
            addPlan(data.plan)
            if (data.points) {
              const { addPoints } = useStore.getState()
              addPoints(data.points)
            }
            if (data.traces) {
              const { setTraces } = useStore.getState()
              setTraces([...useStore.getState().traces, ...data.traces])
            }
            if (data.conflicts) {
              const { addConflicts } = useStore.getState()
              addConflicts(data.conflicts)
            }
          }
        } catch {
          alert('JSON文件格式不正确')
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  return (
    <div className="w-full h-full overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-200">方案工作台</h2>
            <p className="text-xs text-slate-500 mt-1">管理方案版本，保存/加载/导出</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleImportPlan}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 border border-slate-700/50 rounded hover:border-slate-600/50 transition-colors"
            >
              <Upload size={12} />
              导入方案
            </button>
            <button
              onClick={() => setShowNewPlan(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[#00E5A0]/15 text-[#00E5A0] rounded border border-[#00E5A0]/30 hover:bg-[#00E5A0]/25 transition-colors"
            >
              <Plus size={12} />
              新建方案
            </button>
          </div>
        </div>

        {showNewPlan && (
          <div className="rounded-xl border border-[#00E5A0]/30 bg-[#00E5A0]/5 p-4 flex items-center gap-3">
            <input
              type="text"
              value={newPlanName}
              onChange={(e) => setNewPlanName(e.target.value)}
              placeholder="输入方案名称..."
              className="flex-1 px-3 py-2 text-sm bg-slate-900/50 border border-slate-600/50 rounded text-slate-300 placeholder-slate-600 focus:outline-none focus:border-[#00E5A0]/50"
              onKeyDown={(e) => e.key === 'Enter' && handleCreatePlan()}
            />
            <button
              onClick={handleCreatePlan}
              className="px-4 py-2 text-xs bg-[#00E5A0]/20 text-[#00E5A0] rounded hover:bg-[#00E5A0]/30 transition-colors"
            >
              创建
            </button>
            <button
              onClick={() => { setShowNewPlan(false); setNewPlanName('') }}
              className="px-4 py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              取消
            </button>
          </div>
        )}

        {currentPlanId && (
          <div className="rounded-lg bg-slate-800/30 border border-slate-700/30 p-3 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              当前方案: <span className="text-[#00E5A0]">{plans.find((p) => p.id === currentPlanId)?.name}</span>
            </span>
            <button
              onClick={handleSaveCurrentPlan}
              className="px-3 py-1 text-xs bg-[#00E5A0]/15 text-[#00E5A0] rounded border border-[#00E5A0]/30 hover:bg-[#00E5A0]/25 transition-colors"
            >
              保存当前状态
            </button>
          </div>
        )}

        <div className="space-y-3">
          {plans.map((plan) => {
            const planPoints = points.filter((p) => p.planId === plan.id)
            const anomalyCount = planPoints.filter((p) => p.status === 'anomaly').length
            const conflictCount = planPoints.filter((p) => p.status === 'conflict').length
            const isCurrent = plan.id === currentPlanId

            return (
              <div
                key={plan.id}
                className={`rounded-xl border p-4 transition-colors cursor-pointer ${
                  isCurrent
                    ? 'border-[#00E5A0]/30 bg-[#00E5A0]/5'
                    : 'border-slate-700/50 bg-slate-800/20 hover:border-slate-600/50'
                }`}
                onClick={() => {
                  setCurrentPlan(plan.id)
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <FolderOpen size={14} className={isCurrent ? 'text-[#00E5A0]' : 'text-slate-400'} />
                      <span className="text-sm font-semibold text-slate-200">{plan.name}</span>
                      {isCurrent && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-[#00E5A0]/20 text-[#00E5A0] rounded">
                          当前
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-[10px] text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock size={10} />
                        {new Date(plan.updatedAt).toLocaleString('zh-CN')}
                      </span>
                      <span className="flex items-center gap-1">
                        <User size={10} />
                        {plan.creator}
                      </span>
                      {anomalyCount > 0 && (
                        <span className="flex items-center gap-1 text-red-400">
                          <AlertTriangle size={10} />
                          {anomalyCount} 异常
                        </span>
                      )}
                      {conflictCount > 0 && (
                        <span className="flex items-center gap-1 text-amber-400">
                          <AlertTriangle size={10} />
                          {conflictCount} 冲突
                        </span>
                      )}
                      <span>{planPoints.length} 个检测点</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleExportPlan(plan.id) }}
                      className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors"
                      title="导出方案"
                    >
                      <Download size={14} />
                    </button>
                    {!isCurrent && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (confirm('确定删除此方案？')) deletePlan(plan.id)
                        }}
                        className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                        title="删除方案"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
