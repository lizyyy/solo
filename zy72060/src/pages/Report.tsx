import { useStore } from '@/store/useStore'
import { FileText, AlertTriangle, Printer, Shield, ShieldAlert } from 'lucide-react'

export default function Report() {
  const { plans, currentPlanId, points, traces, conflicts } = useStore()

  const currentPlan = plans.find((p) => p.id === currentPlanId)
  const planPoints = currentPlanId ? points.filter((p) => p.planId === currentPlanId) : points

  const normalCount = planPoints.filter((p) => p.status === 'normal').length
  const anomalyCount = planPoints.filter((p) => p.status === 'anomaly').length
  const conflictCount = planPoints.filter((p) => p.status === 'conflict').length
  const pendingCount = planPoints.filter((p) => p.status === 'pending').length

  const totalInSummary = normalCount + anomalyCount + conflictCount + pendingCount
  const totalInDetail = planPoints.length
  const isConsistent = totalInSummary === totalInDetail

  const anomalyPoints = planPoints.filter((p) => p.status !== 'normal')

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="w-full h-full overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between print:hidden">
          <div>
            <h2 className="text-lg font-bold text-slate-200">巡检报告</h2>
            <p className="text-xs text-slate-500 mt-1">
              {currentPlan?.name || '未选择方案'} · 生成时间 {new Date().toLocaleString('zh-CN')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs ${
              isConsistent
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : 'bg-red-500/10 text-red-400 border border-red-500/30'
            }`}>
              {isConsistent ? <Shield size={12} /> : <ShieldAlert size={12} />}
              {isConsistent ? '数据一致' : '数据不一致'}
            </div>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[#00E5A0]/15 text-[#00E5A0] rounded border border-[#00E5A0]/30 hover:bg-[#00E5A0]/25 transition-colors"
            >
              <Printer size={12} />
              打印/导出PDF
            </button>
          </div>
        </div>

        <div className="print:block hidden mb-4">
          <h1 className="text-xl font-bold text-center mb-2">港口岸桥巡检报告</h1>
          <p className="text-center text-sm text-slate-500">{currentPlan?.name}</p>
        </div>

        {!isConsistent && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 flex items-center gap-3 print:hidden">
            <AlertTriangle size={16} className="text-red-400" />
            <div className="text-xs text-red-300">
              报告汇总数({totalInSummary})与明细数({totalInDetail})不一致，请检查数据完整性
            </div>
          </div>
        )}

        <div className="rounded-xl border border-slate-700/50 bg-slate-800/20 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <FileText size={14} className="text-[#00E5A0]" />
            异常汇总
          </h3>
          <div className="grid grid-cols-4 gap-3">
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-center">
              <div className="text-2xl font-bold text-emerald-400">{normalCount}</div>
              <div className="text-[10px] text-emerald-400/70 mt-1">正常</div>
            </div>
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-center">
              <div className="text-2xl font-bold text-red-400">{anomalyCount}</div>
              <div className="text-[10px] text-red-400/70 mt-1">异常</div>
            </div>
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-center">
              <div className="text-2xl font-bold text-amber-400">{conflictCount}</div>
              <div className="text-[10px] text-amber-400/70 mt-1">冲突</div>
            </div>
            <div className="rounded-lg bg-slate-500/10 border border-slate-500/20 p-3 text-center">
              <div className="text-2xl font-bold text-slate-400">{pendingCount}</div>
              <div className="text-[10px] text-slate-400/70 mt-1">待处理</div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-700/50 bg-slate-800/20 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-200">异常/冲突明细</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-700/30">
                  <th className="px-3 py-2 text-left text-slate-400 font-medium">编号</th>
                  <th className="px-3 py-2 text-left text-slate-400 font-medium">构件</th>
                  <th className="px-3 py-2 text-left text-slate-400 font-medium">检测项</th>
                  <th className="px-3 py-2 text-left text-slate-400 font-medium">测量值</th>
                  <th className="px-3 py-2 text-left text-slate-400 font-medium">标准值</th>
                  <th className="px-3 py-2 text-left text-slate-400 font-medium">状态</th>
                  <th className="px-3 py-2 text-left text-slate-400 font-medium">来源</th>
                  <th className="px-3 py-2 text-left text-slate-400 font-medium">处理备注</th>
                  <th className="px-3 py-2 text-left text-slate-400 font-medium">处理时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/20">
                {anomalyPoints.map((p) => {
                  const trace = traces.find((t) => t.pointId === p.id)
                  return (
                    <tr key={p.id} className="hover:bg-slate-800/30">
                      <td className="px-3 py-2 text-slate-300">{p.label}</td>
                      <td className="px-3 py-2 text-slate-300">{p.component}</td>
                      <td className="px-3 py-2 text-slate-300">{p.inspectItem}</td>
                      <td className="px-3 py-2 text-slate-300">{p.measuredValue}</td>
                      <td className="px-3 py-2 text-slate-400">{p.standardValue}</td>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                          p.status === 'anomaly' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                        }`}>
                          {p.status === 'anomaly' ? '异常' : '冲突'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-500">{p.sourceRef}</td>
                      <td className="px-3 py-2 text-slate-300 max-w-[200px] truncate">
                        {trace?.note || '—'}
                      </td>
                      <td className="px-3 py-2 text-slate-500 whitespace-nowrap">
                        {trace?.processedAt ? new Date(trace.processedAt).toLocaleString('zh-CN') : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {conflictCount > 0 && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-amber-400 flex items-center gap-2">
              <AlertTriangle size={14} />
              冲突证据未决项
            </h3>
            <div className="space-y-3">
              {planPoints
                .filter((p) => p.status === 'conflict')
                .map((p) => {
                  const pointConflicts = conflicts.filter((c) => c.pointId === p.id)
                  return (
                    <div key={p.id} className="rounded-lg bg-slate-800/40 border border-slate-700/30 p-3 space-y-2">
                      <p className="text-xs text-slate-200 font-semibold">
                        {p.label} · {p.component} · {p.inspectItem}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {pointConflicts.map((c) => (
                          <div
                            key={c.id}
                            className={`text-[10px] p-2 rounded ${
                              c.side === 'photo'
                                ? 'bg-amber-500/10 text-amber-300'
                                : 'bg-red-500/10 text-red-300'
                            }`}
                          >
                            <span className="font-semibold">{c.side === 'photo' ? '照片' : '数据'}: </span>
                            {c.description}
                          </div>
                        ))}
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
