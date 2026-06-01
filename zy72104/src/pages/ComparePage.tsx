import { useState } from 'react'
import { useStore } from '@/store'
import { ArrowLeftRight } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

export default function ComparePage() {
  const batches = useStore((s) => s.batches)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const calculatedBatches = batches.filter((b) => b.result !== null)

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : prev.length < 5 ? [...prev, id] : prev
    )
  }

  const selectedBatches = calculatedBatches.filter((b) => selectedIds.includes(b.id))
    .sort((a, b) => new Date(a.createTime).getTime() - new Date(b.createTime).getTime())

  const trendData = selectedBatches.map((b) => ({
    name: new Date(b.createTime).toLocaleDateString('zh-CN'),
    totalHead: b.result?.totalHead ?? 0,
    totalLoss: b.result?.totalLoss ?? 0,
    pumpEfficiency: b.result?.pumpEfficiency ?? 0,
    lossRatio: b.result?.lossRatio ?? 0,
    headDeviation: b.result?.headDeviation ?? 0,
  }))

  const compareFields: { key: string; label: string; unit: string }[] = [
    { key: 'staticHead', label: '静扬程', unit: 'm' },
    { key: 'dynamicHead', label: '动扬程', unit: 'm' },
    { key: 'frictionLoss', label: '沿程损失', unit: 'm' },
    { key: 'localLoss', label: '局部损失', unit: 'm' },
    { key: 'totalHead', label: '总扬程', unit: 'm' },
    { key: 'totalLoss', label: '总管损', unit: 'm' },
    { key: 'pumpEfficiency', label: '泵效率', unit: '%' },
    { key: 'headDeviation', label: '扬程偏差', unit: '%' },
    { key: 'lossRatio', label: '管损占比', unit: '%' },
    { key: 'reynoldsNumber', label: '雷诺数', unit: '' },
    { key: 'frictionFactor', label: '摩擦系数', unit: '' },
  ]

  const paramFields: { key: string; label: string }[] = [
    { key: 'pumpModel', label: '泵型号' },
    { key: 'ratedHead', label: '额定扬程' },
    { key: 'ratedFlow', label: '额定流量' },
    { key: 'pipeDiameter', label: '管径' },
    { key: 'pipeLength', label: '管长' },
    { key: 'suctionPressure', label: '吸入压力' },
    { key: 'dischargePressure', label: '排出压力' },
    { key: 'elevationDiff', label: '高程差' },
  ]

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-[#a8d8ea]">历史对比</h2>

      <div className="bg-[#16213e] rounded-lg border border-[#0f3460]/60 p-4">
        <h3 className="text-xs text-[#a8d8ea]/70 mb-3">选择批次对比（最多5个）</h3>
        <div className="flex flex-wrap gap-2">
          {calculatedBatches.map((b) => (
            <button
              key={b.id}
              onClick={() => toggleSelect(b.id)}
              className={`px-3 py-1.5 rounded text-xs transition-colors ${
                selectedIds.includes(b.id)
                  ? 'bg-[#0f3460] text-[#a8d8ea] border border-[#a8d8ea]/40'
                  : 'bg-[#1a1a2e] text-[#a8d8ea]/60 border border-[#0f3460]/40 hover:border-[#0f3460]'
              }`}
            >
              {b.operatorName || '未命名'} ({new Date(b.createTime).toLocaleDateString('zh-CN')})
            </button>
          ))}
          {calculatedBatches.length === 0 && (
            <p className="text-xs text-[#a8d8ea]/40">暂无已计算的批次</p>
          )}
        </div>
      </div>

      {selectedBatches.length >= 2 && (
        <>
          <div className="bg-[#16213e] rounded-lg border border-[#0f3460]/60 p-4">
            <h3 className="text-xs text-[#a8d8ea]/70 mb-3 flex items-center gap-1">
              <ArrowLeftRight size={12} /> 参数对比
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#0f3460]/40">
                    <th className="py-2 px-3 text-left text-[#a8d8ea]/60 font-medium">参数</th>
                    {selectedBatches.map((b) => (
                      <th key={b.id} className="py-2 px-3 text-right text-[#a8d8ea]/60 font-medium">
                        {b.operatorName} ({new Date(b.createTime).toLocaleDateString('zh-CN')})
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paramFields.map((f) => {
                    const values = selectedBatches.map((b) => String((b.equipmentParams as unknown as Record<string, unknown>)[f.key] ?? '-'))
                    const hasDiff = new Set(values).size > 1
                    return (
                      <tr key={f.key} className={`border-b border-[#0f3460]/20 ${hasDiff ? 'bg-[#0f3460]/20' : ''}`}>
                        <td className="py-1.5 px-3 text-[#a8d8ea]/60">{f.label}</td>
                        {values.map((v, i) => (
                          <td key={i} className={`py-1.5 px-3 text-right font-mono ${hasDiff ? 'text-[#e94560]' : 'text-[#e2e8f0]'}`}>
                            {v}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-[#16213e] rounded-lg border border-[#0f3460]/60 p-4">
            <h3 className="text-xs text-[#a8d8ea]/70 mb-3">计算结果对比</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#0f3460]/40">
                    <th className="py-2 px-3 text-left text-[#a8d8ea]/60 font-medium">指标</th>
                    {selectedBatches.map((b) => (
                      <th key={b.id} className="py-2 px-3 text-right text-[#a8d8ea]/60 font-medium">
                        {b.operatorName} ({new Date(b.createTime).toLocaleDateString('zh-CN')})
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {compareFields.map((f) => {
                    const values = selectedBatches.map((b) => (b.result as unknown as Record<string, number> | null)?.[f.key])
                    const numVals = values.filter((v): v is number => v !== undefined && v !== null)
                    const hasDiff = numVals.length > 1 && (Math.max(...numVals) - Math.min(...numVals)) > 0.001
                    return (
                      <tr key={f.key} className={`border-b border-[#0f3460]/20 ${hasDiff ? 'bg-[#0f3460]/20' : ''}`}>
                        <td className="py-1.5 px-3 text-[#a8d8ea]/60">{f.label}</td>
                        {values.map((v, i) => (
                          <td key={i} className={`py-1.5 px-3 text-right font-mono ${hasDiff ? 'text-[#e94560]' : 'text-[#e2e8f0]'}`}>
                            {v !== undefined && v !== null ? v.toFixed(f.key === 'reynoldsNumber' || f.key === 'frictionFactor' ? (f.key === 'frictionFactor' ? 5 : 0) : 2) : '-'}
                            {v !== undefined && v !== null && f.unit ? <span className="text-[#a8d8ea]/40 ml-1">{f.unit}</span> : ''}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {trendData.length >= 2 && (
            <div className="bg-[#16213e] rounded-lg border border-[#0f3460]/60 p-4">
              <h3 className="text-xs text-[#a8d8ea]/70 mb-3">趋势图</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] text-[#a8d8ea]/50 mb-2">总扬程 / 总管损 (m)</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#0f3460" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#a8d8ea80' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#a8d8ea80' }} />
                      <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #0f3460', borderRadius: 8, fontSize: 11, color: '#e2e8f0' }} />
                      <Legend wrapperStyle={{ fontSize: 10, color: '#a8d8ea' }} />
                      <Line type="monotone" dataKey="totalHead" stroke="#a8d8ea" strokeWidth={2} dot={{ r: 3 }} name="总扬程" />
                      <Line type="monotone" dataKey="totalLoss" stroke="#e94560" strokeWidth={2} dot={{ r: 3 }} name="总管损" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <p className="text-[10px] text-[#a8d8ea]/50 mb-2">泵效率 (%) / 管损占比 (%)</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#0f3460" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#a8d8ea80' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#a8d8ea80' }} />
                      <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #0f3460', borderRadius: 8, fontSize: 11, color: '#e2e8f0' }} />
                      <Legend wrapperStyle={{ fontSize: 10, color: '#a8d8ea' }} />
                      <Line type="monotone" dataKey="pumpEfficiency" stroke="#16c79a" strokeWidth={2} dot={{ r: 3 }} name="泵效率" />
                      <Line type="monotone" dataKey="lossRatio" stroke="#e94560" strokeWidth={2} dot={{ r: 3 }} name="管损占比" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
