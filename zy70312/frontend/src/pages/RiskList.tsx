import { useState, useEffect } from 'react'
import { dashboardAPI } from '../api/client'
import { getStatusBadgeClass, getDecisionBadgeClass, statusLabelMap, decisionLabelMap } from '../utils'
import type { RiskItem } from '../types'

export default function RiskList() {
  const [risks, setRisks] = useState<RiskItem[]>([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await dashboardAPI.getRiskList()
        setRisks(data)
      } catch (error) {
        console.error('Failed to fetch risk list:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])
  
  const handleExport = () => {
    dashboardAPI.exportRiskList()
  }
  
  if (loading) {
    return <div className="card p-8 text-center text-gray-500">加载中...</div>
  }
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">发布会风险列表</h2>
        <button onClick={handleExport} className="btn btn-primary btn-sm">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          导出 CSV
        </button>
      </div>
      
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">服务</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">发布决策</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">剩余预算</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">燃烧速度</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">原因</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">建议</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {risks.map((item, index) => (
                <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{item.serviceName}</div>
                    <div className="text-xs text-gray-500">{item.endpoint}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={getStatusBadgeClass(item.status)}>
                      {statusLabelMap[item.status]}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={getDecisionBadgeClass(item.decision)}>
                      {decisionLabelMap[item.decision]}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.remainingBudget}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.burnRate}
                  </td>
                  <td className="px-6 py-4">
                    <ul className="text-sm text-gray-600 space-y-1 max-w-xs">
                      {item.reasons.slice(0, 3).map((r, i) => (
                        <li key={i} className="truncate" title={r}>• {r}</li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-6 py-4">
                    <ul className="text-sm text-gray-600 space-y-1 max-w-xs">
                      {item.recommendations.slice(0, 3).map((r, i) => (
                        <li key={i} className="truncate" title={r}>• {r}</li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="card p-5">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">发布会建议</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <DecisionSummary
            label="继续发布"
            count={risks.filter(r => r.decision === 'continue').length}
            color="#00B42A"
          />
          <DecisionSummary
            label="观察后发布"
            count={risks.filter(r => r.decision === 'observe').length}
            color="#FF7D00"
          />
          <DecisionSummary
            label="需例外审批"
            count={risks.filter(r => r.decision === 'needs_exception').length}
            color="#FFA940"
          />
          <DecisionSummary
            label="禁止发布"
            count={risks.filter(r => r.decision === 'freeze').length}
            color="#F53F3F"
          />
        </div>
      </div>
    </div>
  )
}

function DecisionSummary({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="text-center p-4 rounded-lg" style={{ backgroundColor: color + '15' }}>
      <div className="text-3xl font-bold" style={{ color }}>{count}</div>
      <div className="text-sm text-gray-600 mt-1">{label}</div>
    </div>
  )
}
