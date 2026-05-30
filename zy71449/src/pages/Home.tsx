import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useCubeStore } from '@/store/useCubeStore'
import LossCube from '@/components/cube/LossCube'
import ParameterPanel from '@/components/panels/ParameterPanel'
import DataSourcePanel from '@/components/panels/DataSourcePanel'
import DrillDownPanel from '@/components/panels/DrillDownPanel'
import ExportPanel from '@/components/panels/ExportPanel'
import TimelineController from '@/components/timeline/TimelineController'
import { History, Download, Database, BarChart3 } from 'lucide-react'

export default function Home() {
  const parameters = useCubeStore(s => s.parameters)
  const policies = useCubeStore(s => s.policies)
  const claims = useCubeStore(s => s.claims)
  const anomalies = useCubeStore(s => s.anomalies)
  const setShowExportPanel = useCubeStore(s => s.setShowExportPanel)
  const recomputeAnomalies = useCubeStore(s => s.recomputeAnomalies)

  useEffect(() => {
    recomputeAnomalies()
  }, [])

  const filteredPolicies = policies.filter(
    p => p.typhoonId === parameters.typhoonId && parameters.regionIds.includes(p.regionId)
  )
  const filteredClaims = claims.filter(
    c => c.typhoonId === parameters.typhoonId && parameters.regionIds.includes(c.regionId)
  )

  const totalInsured = filteredPolicies.reduce((s, p) => s + p.insuredAmount, 0)
  const totalClaim = filteredClaims.reduce((s, c) => s + c.claimAmount, 0)
  const lossRatio = totalInsured > 0 ? (totalClaim / totalInsured * 100).toFixed(2) : '0.00'
  const unackAnomalies = anomalies.filter(a => !a.acknowledged).length

  return (
    <div className="h-screen flex flex-col bg-[#060E1A] overflow-hidden">
      <header className="flex items-center justify-between px-4 py-2 border-b border-[#1B3054] bg-[#0A1422]/80 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <BarChart3 size={20} className="text-[#00D4FF]" />
            <h1 className="text-base font-bold text-[#E0E8F0] tracking-wide">
              保险灾害损失立方
            </h1>
          </div>
          <span className="text-[10px] text-[#5A6E8A] bg-[#0D1B2E] px-2 py-0.5 rounded border border-[#1B3054]">
            Insurance Disaster Loss Cube
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-4 text-xs mr-4">
            <div className="flex items-center gap-1.5">
              <Database size={12} className="text-[#00E676]" />
              <span className="text-[#7B8CA8]">保额</span>
              <span className="text-[#E0E8F0] font-mono">¥{(totalInsured / 100000000).toFixed(2)}亿</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[#7B8CA8]">赔付</span>
              <span className="text-[#E0E8F0] font-mono">¥{(totalClaim / 10000).toFixed(0)}万</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[#7B8CA8]">赔付率</span>
              <span className={`font-mono ${Number(lossRatio) > 50 ? 'text-[#FF6B35]' : 'text-[#00E676]'}`}>
                {lossRatio}%
              </span>
            </div>
            {unackAnomalies > 0 && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#FF6B35]/10 text-[#FF6B35]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B35] animate-pulse" />
                {unackAnomalies} 异常
              </div>
            )}
          </div>

          <button
            onClick={() => setShowExportPanel(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs bg-[#0D1B2E] text-[#5A6E8A] border border-[#1B3054] hover:border-[#00D4FF]/40 hover:text-[#00D4FF] transition-all"
          >
            <Download size={13} />
            导出
          </button>

          <Link
            to="/history"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs bg-[#0D1B2E] text-[#5A6E8A] border border-[#1B3054] hover:border-[#00D4FF]/40 hover:text-[#00D4FF] transition-all"
          >
            <History size={13} />
            历史
          </Link>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 relative">
          <LossCube />
        </main>

        <aside className="w-72 border-l border-[#1B3054] bg-[#0A1422]/80 backdrop-blur-sm overflow-y-auto flex-shrink-0">
          <div className="p-4 space-y-4">
            <ParameterPanel />
            <div className="border-t border-[#1B3054] pt-4">
              <DataSourcePanel />
            </div>
          </div>
        </aside>
      </div>

      <div className="flex-shrink-0">
        <TimelineController />
      </div>

      <DrillDownPanel />
      <ExportPanel />
    </div>
  )
}
