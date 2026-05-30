import { useCubeStore } from '@/store/useCubeStore'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { X, MapPin, FileText, DollarSign } from 'lucide-react'

export default function DrillDownPanel() {
  const selectedRegionId = useCubeStore(s => s.selectedRegionId)
  const showDrillDown = useCubeStore(s => s.showDrillDown)
  const setShowDrillDown = useCubeStore(s => s.setShowDrillDown)
  const regions = useCubeStore(s => s.regions)
  const policies = useCubeStore(s => s.policies)
  const claims = useCubeStore(s => s.claims)
  const parameters = useCubeStore(s => s.parameters)
  const addDecision = useCubeStore(s => s.addDecision)

  if (!showDrillDown || !selectedRegionId) return null

  const region = regions.find(r => r.id === selectedRegionId)
  if (!region) return null

  const regionPolicies = policies.filter(
    p => p.regionId === selectedRegionId && p.typhoonId === parameters.typhoonId
  )
  const regionClaims = claims.filter(
    c => c.regionId === selectedRegionId && c.typhoonId === parameters.typhoonId
  )

  const totalInsured = regionPolicies.reduce((s, p) => s + p.insuredAmount, 0)
  const totalClaim = regionClaims.reduce((s, c) => s + c.claimAmount, 0)
  const lossRatio = totalInsured > 0 ? (totalClaim / totalInsured * 100).toFixed(2) : '0.00'

  const claimBySource = regionClaims.reduce((acc, c) => {
    const existing = acc.find(a => a.source === c.source)
    if (existing) {
      existing.amount += c.claimAmount
      existing.count += 1
    } else {
      acc.push({ source: c.source, amount: c.claimAmount, count: 1 })
    }
    return acc
  }, [] as { source: string; amount: number; count: number }[])

  const sourceLabels: Record<string, string> = {
    direct_report: '直接报案',
    adjuster_assessment: '公估评估',
    satellite_estimate: '卫星估算',
    agency_submission: '代理提交',
  }

  const chartData = claimBySource.map(s => ({
    source: sourceLabels[s.source] || s.source,
    amount: Math.round(s.amount / 10000),
    count: s.count,
  }))

  return (
    <div className="fixed right-0 top-0 h-full w-80 bg-[#0A1422]/95 backdrop-blur-xl border-l border-[#1B3054] z-50 flex flex-col shadow-2xl shadow-black/40">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1B3054]">
        <div className="flex items-center gap-2">
          <MapPin size={16} className="text-[#00D4FF]" />
          <span className="text-sm font-semibold text-[#E0E8F0]">{region.name} · 地区钻取</span>
        </div>
        <button
          onClick={() => setShowDrillDown(false)}
          className="text-[#5A6E8A] hover:text-[#E0E8F0] transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-[#0D1B2E] rounded p-3 border border-[#1B3054]">
            <div className="text-[10px] text-[#5A6E8A] flex items-center gap-1">
              <FileText size={10} /> 保单数
            </div>
            <div className="text-lg font-mono text-[#00E676] mt-1">{regionPolicies.length}</div>
          </div>
          <div className="bg-[#0D1B2E] rounded p-3 border border-[#1B3054]">
            <div className="text-[10px] text-[#5A6E8A] flex items-center gap-1">
              <DollarSign size={10} /> 赔付数
            </div>
            <div className="text-lg font-mono text-[#FF6B35] mt-1">{regionClaims.length}</div>
          </div>
        </div>

        <div className="bg-[#0D1B2E] rounded p-3 border border-[#1B3054]">
          <div className="grid grid-cols-2 gap-y-2 text-xs">
            <div>
              <span className="text-[#5A6E8A]">总保额</span>
              <div className="text-[#E0E8F0] font-mono">¥{(totalInsured / 10000).toFixed(0)}万</div>
            </div>
            <div>
              <span className="text-[#5A6E8A]">总赔付</span>
              <div className="text-[#E0E8F0] font-mono">¥{(totalClaim / 10000).toFixed(0)}万</div>
            </div>
            <div className="col-span-2">
              <span className="text-[#5A6E8A]">赔付率</span>
              <div className={`font-mono text-lg ${Number(lossRatio) > 50 ? 'text-[#FF6B35]' : 'text-[#00E676]'}`}>
                {lossRatio}%
              </div>
            </div>
          </div>
        </div>

        {chartData.length > 0 && (
          <div className="bg-[#0D1B2E] rounded p-3 border border-[#1B3054]">
            <div className="text-[10px] text-[#5A6E8A] mb-2">赔付来源分布 (万元)</div>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1B3054" />
                <XAxis dataKey="source" tick={{ fill: '#7B8CA8', fontSize: 10 }} />
                <YAxis tick={{ fill: '#7B8CA8', fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    background: '#0A1422',
                    border: '1px solid #1B3054',
                    borderRadius: 6,
                    fontSize: 10,
                  }}
                />
                <Bar dataKey="amount" fill="#00D4FF" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="bg-[#0D1B2E] rounded p-3 border border-[#1B3054]">
          <div className="text-[10px] text-[#5A6E8A] mb-2">保单明细 (溯源链)</div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {regionPolicies.slice(0, 10).map(p => (
              <div key={p.id} className="flex items-center justify-between text-[10px] px-2 py-1 bg-[#060E1A] rounded">
                <div>
                  <span className="text-[#E0E8F0] font-mono">{p.id}</span>
                  <span className="text-[#5A6E8A] ml-1">{p.policyType}</span>
                </div>
                <span className="text-[#00E676] font-mono">¥{(p.insuredAmount / 10000).toFixed(0)}万</span>
              </div>
            ))}
            {regionPolicies.length > 10 && (
              <div className="text-[10px] text-[#5A6E8A] text-center">
                还有 {regionPolicies.length - 10} 条...
              </div>
            )}
          </div>
        </div>

        <div className="bg-[#0D1B2E] rounded p-3 border border-[#1B3054]">
          <div className="text-[10px] text-[#5A6E8A] mb-2">赔付明细 (溯源链)</div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {regionClaims.slice(0, 10).map(c => (
              <div key={c.id} className="flex items-center justify-between text-[10px] px-2 py-1 bg-[#060E1A] rounded">
                <div>
                  <span className="text-[#E0E8F0] font-mono">{c.id}</span>
                  <span className="text-[#5A6E8A] ml-1">{sourceLabels[c.source] || c.source}</span>
                </div>
                <span className="text-[#FF6B35] font-mono">¥{(c.claimAmount / 10000).toFixed(1)}万</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
