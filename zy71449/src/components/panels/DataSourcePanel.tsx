import { useCubeStore } from '@/store/useCubeStore'
import { ANOMALY_LABELS, SEVERITY_COLORS } from '@/engine/anomalyEngine'
import { AlertTriangle, CheckCircle2, Shield, FileText } from 'lucide-react'

export default function DataSourcePanel() {
  const anomalies = useCubeStore(s => s.anomalies)
  const decisions = useCubeStore(s => s.decisions)
  const acknowledgeAnomaly = useCubeStore(s => s.acknowledgeAnomaly)
  const parameters = useCubeStore(s => s.parameters)
  const typhoonPathPoints = useCubeStore(s => s.typhoonPathPoints)
  const policies = useCubeStore(s => s.policies)
  const claims = useCubeStore(s => s.claims)

  const filteredPaths = typhoonPathPoints.filter(p => p.typhoonId === parameters.typhoonId)
  const filteredPolicies = policies.filter(
    p => p.typhoonId === parameters.typhoonId && parameters.regionIds.includes(p.regionId)
  )
  const filteredClaims = claims.filter(
    c => c.typhoonId === parameters.typhoonId && parameters.regionIds.includes(c.regionId)
  )

  const sourceGroups = [
    { type: '台风路径', count: filteredPaths.length, color: '#00D4FF', icon: '🌀' },
    { type: '保单数据', count: filteredPolicies.length, color: '#00E676', icon: '📋' },
    { type: '赔付记录', count: filteredClaims.length, color: '#FF6B35', icon: '💰' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-[#00D4FF]">
        <Shield size={16} />
        <span className="text-sm font-semibold tracking-wide">数据溯源</span>
      </div>

      <div className="space-y-1.5">
        {sourceGroups.map(g => (
          <div
            key={g.type}
            className="flex items-center justify-between px-3 py-2 rounded bg-[#0D1B2E] border border-[#1B3054]"
          >
            <span className="flex items-center gap-2 text-xs">
              <span>{g.icon}</span>
              <span className="text-[#E0E8F0]">{g.type}</span>
            </span>
            <span className="text-xs font-mono" style={{ color: g.color }}>
              {g.count} 条
            </span>
          </div>
        ))}
      </div>

      <div className="border-t border-[#1B3054] pt-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-[#7B8CA8] flex items-center gap-1">
            <AlertTriangle size={12} />
            异常标记
          </span>
          <span className={`text-xs font-mono ${
            anomalies.length > 0 ? 'text-[#FF6B35]' : 'text-[#00E676]'
          }`}>
            {anomalies.length}
          </span>
        </div>

        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
          {anomalies.length === 0 && (
            <div className="text-xs text-[#5A6E8A] text-center py-2">
              未检测到异常
            </div>
          )}
          {anomalies.map(a => (
            <div
              key={a.id}
              className={`px-2 py-1.5 rounded text-[10px] border ${
                a.acknowledged
                  ? 'bg-[#0D1B2E] border-[#1B3054] opacity-60'
                  : 'bg-[#1A0E08] border-[#3D2210]'
              }`}
            >
              <div className="flex items-start justify-between gap-1">
                <div className="flex items-center gap-1">
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: SEVERITY_COLORS[a.severity] }}
                  />
                  <span className="text-[#E0E8F0] font-medium">
                    {ANOMALY_LABELS[a.type]}
                  </span>
                </div>
                {!a.acknowledged && (
                  <button
                    onClick={() => acknowledgeAnomaly(a.id)}
                    className="text-[#00E676] hover:text-[#00E676]/80 flex-shrink-0"
                    title="确认"
                  >
                    <CheckCircle2 size={12} />
                  </button>
                )}
              </div>
              <p className="text-[#7B8CA8] mt-0.5 leading-tight">{a.description}</p>
              <div className="flex items-center gap-2 mt-1 text-[#5A6E8A]">
                <span>来源: {a.sourceType}</span>
                <span>·</span>
                <span>{a.severity === 'high' ? '高' : a.severity === 'medium' ? '中' : '低'}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-[#1B3054] pt-3">
        <div className="flex items-center gap-1 text-xs text-[#7B8CA8] mb-2">
          <FileText size={12} />
          处理决策
        </div>
        <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
          {decisions.length === 0 && (
            <div className="text-xs text-[#5A6E8A] text-center py-2">
              暂无决策记录
            </div>
          )}
          {decisions.map(d => (
            <div
              key={d.id}
              className="px-2 py-1.5 rounded bg-[#0D1B2E] border border-[#1B3054] text-[10px]"
            >
              <div className="text-[#E0E8F0] font-medium">{d.action}</div>
              <div className="text-[#7B8CA8] mt-0.5">{d.reason}</div>
              <div className="text-[#5A6E8A] mt-0.5">
                {d.operator} · {new Date(d.timestamp).toLocaleString('zh-CN')}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
