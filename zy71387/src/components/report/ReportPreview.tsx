import { FileText } from 'lucide-react'
import { useReportStore } from '@/store/useReportStore'
import SeverityBadge from '@/components/scan/SeverityBadge'
import type { RiskItemStatus } from '@/types'

const statusLabel: Record<RiskItemStatus, string> = {
  pending: '待处理',
  confirmed: '已确认',
  ignored: '已忽略',
}

function formatDate(iso: string) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function ReportPreview() {
  const currentReport = useReportStore((s) => s.currentReport)

  if (!currentReport) {
    return (
      <div className="bg-base-800 border border-base-600 rounded-lg p-8 min-h-[600px] flex items-center justify-center">
        <div className="text-center">
          <FileText size={48} className="text-muted mx-auto mb-3" />
          <p className="text-muted">请先生成巡检报告</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-base-800 border border-base-600 rounded-lg p-8 min-h-[600px]">
      <div className="mb-6">
        <h1 className="font-mono text-2xl text-accent">{currentReport.title}</h1>
        <p className="text-muted text-sm mt-1">生成时间: {formatDate(currentReport.generatedAt)}</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-base-700 rounded-lg p-4 text-center">
          <p className="text-muted text-xs mb-1">血缘断点</p>
          <p className="text-danger text-2xl font-bold">{currentReport.totalBreakpoints}</p>
        </div>
        <div className="bg-base-700 rounded-lg p-4 text-center">
          <p className="text-muted text-xs mb-1">风险总数</p>
          <p className="text-white text-2xl font-bold">{currentReport.totalRisks}</p>
        </div>
        <div className="bg-base-700 rounded-lg p-4 text-center">
          <p className="text-muted text-xs mb-1">高危数</p>
          <p className="text-danger text-2xl font-bold">{currentReport.highRiskCount}</p>
        </div>
        <div className="bg-base-700 rounded-lg p-4 text-center">
          <p className="text-muted text-xs mb-1">中危数</p>
          <p className="text-warn text-2xl font-bold">{currentReport.mediumRiskCount}</p>
        </div>
      </div>

      <div className="bg-base-700 rounded p-4 mt-6">
        <h3 className="text-white text-sm font-medium mb-2">巡检摘要</h3>
        <pre className="whitespace-pre-line text-sm text-gray-300 font-sans">{currentReport.summary}</pre>
      </div>

      <div className="mt-6">
        <h3 className="text-white text-sm font-medium mb-3">主要风险项</h3>
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-base-700">
              <th className="text-muted text-xs uppercase px-3 py-2 text-left">序号</th>
              <th className="text-muted text-xs uppercase px-3 py-2 text-left">类型</th>
              <th className="text-muted text-xs uppercase px-3 py-2 text-left">严重程度</th>
              <th className="text-muted text-xs uppercase px-3 py-2 text-left">描述</th>
              <th className="text-muted text-xs uppercase px-3 py-2 text-left">影响范围</th>
              <th className="text-muted text-xs uppercase px-3 py-2 text-left">状态</th>
            </tr>
          </thead>
          <tbody>
            {currentReport.topRisks.map((risk, idx) => (
              <tr key={risk.id} className="border-b border-base-600">
                <td className="px-3 py-2 text-sm text-muted">{idx + 1}</td>
                <td className="px-3 py-2 text-sm font-mono text-muted">{risk.riskType}</td>
                <td className="px-3 py-2">
                  <SeverityBadge severity={risk.severity} />
                </td>
                <td className="px-3 py-2 text-sm text-white">{risk.description}</td>
                <td className="px-3 py-2 text-sm text-muted">{risk.impactRange}</td>
                <td className="px-3 py-2 text-sm text-muted">{statusLabel[risk.status]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6">
        <h3 className="text-white text-sm font-medium mb-3">关联变更单</h3>
        <div className="space-y-2">
          {currentReport.changeOrders.map((co) => (
            <div key={co.id} className="bg-base-700 rounded px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-white text-sm">{co.title}</p>
                <p className="text-muted text-xs mt-0.5">
                  类型: {co.changeType} | 创建时间: {formatDate(co.createdAt)}
                </p>
              </div>
              <span className={`text-xs px-2 py-1 rounded ${
                co.status === 'approved' ? 'bg-safe-glow text-safe' :
                co.status === 'pending' ? 'bg-warn-glow text-warn' :
                'bg-base-600 text-muted'
              }`}>
                {co.status === 'approved' ? '已批准' : co.status === 'pending' ? '待审批' : co.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
