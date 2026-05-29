import { useStore } from '@/store'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const barColors = ['#E74C3C', '#E74C3C', '#F5A623', '#F5A623', '#00D9A6', '#F5A623', '#00D9A6']

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const data = payload[0].payload
  return (
    <div className="bg-[#1a2332] border border-[#2a3a4d] rounded-md px-3 py-2 shadow-xl">
      <p className="text-[10px] text-[#c8d6e5] font-['JetBrains_Mono'] mb-1 max-w-64 truncate">
        {data.name}
      </p>
      <p className="text-[11px] text-[#8b9db3]">
        影响值: <span className="text-white font-['JetBrains_Mono']">{data.impact.toFixed(0)}</span>
      </p>
      <p className="text-[10px] text-[#4a5f75] mt-0.5">
        = 扫描行({data.scanLabel}) × 频次({data.count})
      </p>
    </div>
  )
}

export default function ImpactChart({ clusterId }: { clusterId: string }) {
  const clusters = useStore((s) => s.clusters)
  const logs = useStore((s) => s.logs)
  const members = useStore((s) => s.clusterMembers)

  const currentCluster = clusters.find((c) => c.id === clusterId)
  if (!currentCluster) return null

  const clusterLogs = members
    .filter((m) => m.cluster_id === clusterId)
    .map((m) => logs.find((l) => l.id === m.log_id))
    .filter(Boolean)

  const allClusters = clusters.map((c) => {
    const cLogs = members
      .filter((m) => m.cluster_id === c.id)
      .map((m) => logs.find((l) => l.id === m.log_id))
      .filter(Boolean)

    const avgScan = c.avg_scan_rows ?? cLogs.reduce((s, l) => s + (l?.scan_rows ?? 500000), 0) / Math.max(cLogs.length, 1)
    const impact = avgScan * c.count

    return {
      name: c.sql_summary.slice(0, 35),
      impact,
      count: c.count,
      scanRows: avgScan,
      scanLabel: c.avg_scan_rows === null ? '估算' : avgScan >= 1000000 ? `${(avgScan / 1000000).toFixed(1)}M` : `${(avgScan / 1000).toFixed(0)}K`,
      isCurrent: c.id === clusterId,
    }
  })

  const sorted = [...allClusters].sort((a, b) => b.impact - a.impact)
  const currentIdx = sorted.findIndex((s) => s.isCurrent)

  return (
    <div className="bg-[#141b22] rounded-lg border border-[#1e2a36] overflow-hidden">
      <div className="px-4 py-3 border-b border-[#1e2a36]">
        <h3 className="text-xs font-semibold text-[#a0b3c6] uppercase tracking-wider">
          影响排序（扫描行 × 频次）
        </h3>
      </div>
      <div className="px-2 py-3 h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={sorted} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
            <XAxis
              type="number"
              tick={{ fontSize: 10, fill: '#4a5f75' }}
              axisLine={{ stroke: '#1e2a36' }}
              tickLine={false}
              tickFormatter={(v: number) => v >= 1000000 ? `${(v / 1000000).toFixed(0)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : `${v}`}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 9, fill: '#6b7f94' }}
              axisLine={{ stroke: '#1e2a36' }}
              tickLine={false}
              width={120}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="impact" radius={[0, 3, 3, 0]} barSize={16}>
              {sorted.map((_, i) => (
                <Cell
                  key={i}
                  fill={i === currentIdx ? '#00D9A6' : barColors[i % barColors.length]}
                  opacity={i === currentIdx ? 1 : 0.4}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
