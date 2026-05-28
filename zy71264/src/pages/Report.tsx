import { useState, useRef, useMemo } from 'react'
import { useStore } from '@/store/useStore'
import TopNavbar from '@/components/ui/TopNavbar'
import { FileText, Download, Copy, Mail, Camera, AlertTriangle, CheckCircle, XCircle, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AnomalyItem } from '@/types'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

function generateRecommendations(anomalies: AnomalyItem[]): string[] {
  const recommendations: string[] = []

  const reversedAirflow = anomalies.filter(a => a.type === 'reversed_airflow')
  if (reversedAirflow.length > 0) {
    const criticalCount = reversedAirflow.filter(a => a.severity === 'critical').length
    recommendations.push(
      `检测到 ${reversedAirflow.length} 处反向气流${criticalCount > 0 ? `（含 ${criticalCount} 处严重）` : ''}，建议检查机柜布局，优化冷热通道隔离。`
    )
  }

  const missingPower = anomalies.filter(a => a.type === 'missing_power')
  if (missingPower.length > 0) {
    const rackLabels = missingPower.map(a => a.rackId).join('、')
    recommendations.push(
      `${rackLabels} 功耗数据缺失，建议核实机柜运行状态，检查 PDU 监控连接。`
    )
  }

  const hotspotOccluded = anomalies.filter(a => a.type === 'hotspot_occluded')
  if (hotspotOccluded.length > 0) {
    const criticalHotspots = hotspotOccluded.filter(a => a.severity === 'critical')
    if (criticalHotspots.length > 0) {
      recommendations.push(
        `${criticalHotspots.map(a => a.rackId).join('、')} 存在严重热点且冷气路径被遮挡，建议立即调整机柜布局或增加局部通风。`
      )
    } else {
      recommendations.push(
        `${hotspotOccluded.length} 处热点区域通风不足，建议优化地板开孔率，调整 CRAC 送风方向。`
      )
    }
  }

  if (recommendations.length === 0) {
    recommendations.push('当前配置运行良好，建议定期巡检，保持通风系统清洁。')
  }

  return recommendations
}

export default function Report() {
  const { paramSet, anomalies, score } = useStore()
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)
  const reportRef = useRef<HTMLDivElement>(null)

  const recommendations = useMemo(() => generateRecommendations(anomalies), [anomalies])

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-500 bg-red-50'
      case 'warning': return 'text-orange-500 bg-orange-50'
      case 'info': return 'text-blue-500 bg-blue-50'
      default: return 'text-gray-500 bg-gray-50'
    }
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <XCircle className="w-4 h-4" />
      case 'warning': return <AlertTriangle className="w-4 h-4" />
      case 'info': return <CheckCircle className="w-4 h-4" />
      default: return <CheckCircle className="w-4 h-4" />
    }
  }

  const getAnomalyTypeName = (type: string) => {
    switch (type) {
      case 'reversed_airflow': return '反向气流'
      case 'missing_power': return '功耗缺失'
      case 'hotspot_occluded': return '热点遮挡'
      default: return type
    }
  }

  const getScoreColor = (s: number) => {
    if (s >= 80) return 'text-green-600 bg-green-100 border-green-200'
    if (s >= 60) return 'text-yellow-600 bg-yellow-100 border-yellow-200'
    return 'text-red-600 bg-red-100 border-red-200'
  }

  const getProgressColor = (s: number) => {
    if (s >= 80) return 'bg-green-500'
    if (s >= 60) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const handleGenerateScreenshot = async () => {
    setIsGenerating(true)
    try {
      if (reportRef.current) {
        const canvas = await html2canvas(reportRef.current, {
          backgroundColor: '#ffffff',
          scale: 2,
          logging: false,
        })
        const dataUrl = canvas.toDataURL('image/png')
        setScreenshotUrl(dataUrl)
      }
    } catch (error) {
      console.error('Failed to generate screenshot:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleExportPDF = async () => {
    setIsGenerating(true)
    try {
      if (reportRef.current) {
        const canvas = await html2canvas(reportRef.current, {
          backgroundColor: '#ffffff',
          scale: 2,
          logging: false,
        })
        const imgData = canvas.toDataURL('image/png')
        const pdf = new jsPDF('p', 'mm', 'a4')
        const pdfWidth = pdf.internal.pageSize.getWidth()
        const pdfHeight = pdf.internal.pageSize.getHeight()
        const imgWidth = canvas.width
        const imgHeight = canvas.height
        const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight)
        const imgX = (pdfWidth - imgWidth * ratio) / 2
        const imgY = 0
        pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio)
        pdf.save(`风道分析报告_${paramSet.name}_${new Date().toISOString().split('T')[0]}.pdf`)
      }
    } catch (error) {
      console.error('Failed to export PDF:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopySnapshot = () => {
    const snapshot = {
      name: paramSet.name,
      version: paramSet.version,
      notes: paramSet.notes,
      receipt: paramSet.receipt,
      globalPowerKw: paramSet.globalPowerKw,
      globalAirflowCfm: paramSet.globalAirflowCfm,
      floorPerforation: paramSet.floorPerforation,
      aisleGap: paramSet.aisleGap,
      overallScore: score.overallScore,
      timestamp: new Date().toISOString(),
    }
    navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2))
    setCopySuccess(true)
    setTimeout(() => setCopySuccess(false), 2000)
  }

  const handleSendEmail = () => {
    const subject = encodeURIComponent(`数据中心风道分析报告 - ${paramSet.name}`)
    const body = encodeURIComponent(
      `报告名称：数据中心风道分析报告\n` +
      `参数方案：${paramSet.name}\n` +
      `综合评分：${score.overallScore}/100\n` +
      `生成时间：${new Date().toLocaleString()}\n\n` +
      `参数快照：\n` +
      `  - 总功率：${paramSet.globalPowerKw} kW\n` +
      `  - 总风量：${paramSet.globalAirflowCfm} CFM\n` +
      `  - 地板开孔率：${(paramSet.floorPerforation * 100).toFixed(0)}%\n` +
      `  - 通道间距：${paramSet.aisleGap} m\n\n` +
      `异常统计：\n` +
      `  - 严重：${anomalies.filter(a => a.severity === 'critical').length} 项\n` +
      `  - 警告：${anomalies.filter(a => a.severity === 'warning').length} 项\n` +
      `  - 信息：${anomalies.filter(a => a.severity === 'info').length} 项\n`
    )
    window.location.href = `mailto:?subject=${subject}&body=${body}`
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const scoreMetrics = [
    { name: '制冷效率', value: score.coolingEfficiency, explanation: '衡量CRAC单位制冷量与机架总散热量的比值，越高表示制冷效率越好。' },
    { name: '热点控制', value: 100 - score.hotspotCount, explanation: '检测温度超过阈值的区域数量，热点越少得分越高。' },
    { name: '气流利用率', value: score.airflowUtilization, explanation: '衡量有效冷却气流与总送风量的比值，反映气流组织的合理性。' },
  ]

  return (
    <div className="w-full h-screen flex flex-col bg-dc-bg">
      <TopNavbar />
      <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-dc-cold" />
            <h1 className="text-lg font-medium text-dc-text">报告导出</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPDF}
              disabled={isGenerating}
              className="flex items-center gap-2 px-4 py-2 bg-dc-cold text-dc-bg rounded-md text-sm font-medium hover:bg-opacity-90 transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              导出PDF
            </button>
            <button
              onClick={handleCopySnapshot}
              disabled={isGenerating}
              className="flex items-center gap-2 px-4 py-2 bg-dc-panel border border-dc-border text-dc-text rounded-md text-sm font-medium hover:bg-dc-bg transition-colors disabled:opacity-50"
            >
              <Copy className="w-4 h-4" />
              {copySuccess ? '已复制' : '复制参数快照'}
            </button>
            <button
              onClick={handleSendEmail}
              disabled={isGenerating}
              className="flex items-center gap-2 px-4 py-2 bg-dc-panel border border-dc-border text-dc-text rounded-md text-sm font-medium hover:bg-dc-bg transition-colors disabled:opacity-50"
            >
              <Mail className="w-4 h-4" />
              发送邮件
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto pb-4">
          <div className="max-w-4xl mx-auto">
            <div
              ref={reportRef}
              className="bg-white shadow-2xl mx-auto p-12 font-sans"
              style={{ width: '210mm', minHeight: '297mm' }}
            >
              <div className="flex items-center justify-between mb-8 pb-6 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-dc-cold rounded-lg flex items-center justify-center">
                    <Activity className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold font-mono text-gray-900">数据中心风道分析报告</h1>
                    <p className="text-sm text-gray-500">DC-AIR 3D Airflow Analysis</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-500">{formatDate(paramSet.timestamp)}</div>
                  <div className="text-sm font-medium text-gray-700">{paramSet.name} <span className="text-gray-400 text-xs">v{paramSet.version}</span></div>
                </div>
              </div>

              <div className="mb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">概览</h2>
                {(paramSet.notes || paramSet.receipt) && (
                  <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
                    {paramSet.notes && (
                      <div className="mb-2">
                        <span className="text-xs font-medium text-blue-700">备注：</span>
                        <span className="text-sm text-blue-900">{paramSet.notes}</span>
                      </div>
                    )}
                    {paramSet.receipt && (
                      <div>
                        <span className="text-xs font-medium text-blue-700">回执：</span>
                        <span className="text-sm text-blue-900">{paramSet.receipt}</span>
                      </div>
                    )}
                  </div>
                )}
                <div className="flex items-start justify-between gap-6">
                  <div className={cn(
                    'px-6 py-4 rounded-lg border',
                    getScoreColor(score.overallScore)
                  )}>
                    <div className="text-xs uppercase tracking-wider opacity-75 mb-1">综合评分</div>
                    <div className="text-5xl font-bold font-mono">{score.overallScore}</div>
                    <div className="text-xs opacity-75 mt-1">/ 100</div>
                  </div>
                  <div className="flex-1 grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="text-xs text-gray-500 mb-1">总功率</div>
                      <div className="text-xl font-semibold text-gray-900 font-mono">{paramSet.globalPowerKw} <span className="text-sm font-normal text-gray-500">kW</span></div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="text-xs text-gray-500 mb-1">总风量</div>
                      <div className="text-xl font-semibold text-gray-900 font-mono">{paramSet.globalAirflowCfm} <span className="text-sm font-normal text-gray-500">CFM</span></div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="text-xs text-gray-500 mb-1">地板开孔率</div>
                      <div className="text-xl font-semibold text-gray-900 font-mono">{(paramSet.floorPerforation * 100).toFixed(0)}<span className="text-sm font-normal text-gray-500">%</span></div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="text-xs text-gray-500 mb-1">通道间距</div>
                      <div className="text-xl font-semibold text-gray-900 font-mono">{paramSet.aisleGap} <span className="text-sm font-normal text-gray-500">m</span></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">3D 场景视图</h2>
                {screenshotUrl ? (
                  <div className="rounded-lg overflow-hidden border border-gray-200">
                    <img src={screenshotUrl} alt="3D Scene" className="w-full h-auto" />
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-12 flex flex-col items-center justify-center">
                    <Camera className="w-12 h-12 text-gray-400 mb-4" />
                    <p className="text-gray-500 mb-4">点击下方按钮生成 3D 场景截图</p>
                    <button
                      onClick={handleGenerateScreenshot}
                      disabled={isGenerating}
                      className="flex items-center gap-2 px-6 py-2 bg-dc-cold text-white rounded-md text-sm font-medium hover:bg-opacity-90 transition-colors disabled:opacity-50"
                    >
                      {isGenerating ? '生成中...' : '点击生成截图'}
                    </button>
                  </div>
                )}
              </div>

              <div className="mb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">异常汇总</h2>
                {anomalies.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="text-left px-4 py-3 font-medium text-gray-600">类型</th>
                          <th className="text-left px-4 py-3 font-medium text-gray-600">严重程度</th>
                          <th className="text-left px-4 py-3 font-medium text-gray-600">位置</th>
                          <th className="text-left px-4 py-3 font-medium text-gray-600">描述</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {anomalies.map((anomaly) => (
                          <tr key={anomaly.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-gray-900">{getAnomalyTypeName(anomaly.type)}</td>
                            <td className="px-4 py-3">
                              <span className={cn('inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium', getSeverityColor(anomaly.severity))}>
                                {getSeverityIcon(anomaly.severity)}
                                {anomaly.severity === 'critical' ? '严重' : anomaly.severity === 'warning' ? '警告' : '信息'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                              ({anomaly.position[0].toFixed(1)}, {anomaly.position[1].toFixed(1)}, {anomaly.position[2].toFixed(1)})
                            </td>
                            <td className="px-4 py-3 text-gray-700">{anomaly.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="bg-green-50 rounded-lg p-6 text-center">
                    <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                    <p className="text-green-700">未检测到异常</p>
                  </div>
                )}
              </div>

              <div className="mb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">评分明细</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="text-left px-4 py-3 font-medium text-gray-600">指标名称</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">得分</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">说明</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {scoreMetrics.map((metric, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-900 font-medium">{metric.name}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <span className="font-mono font-semibold text-gray-900 w-12">{metric.value.toFixed(1)}</span>
                              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden min-w-[100px]">
                                <div
                                  className={cn('h-full rounded-full', getProgressColor(metric.value))}
                                  style={{ width: `${Math.min(100, metric.value)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-600 text-xs">{metric.explanation}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">优化建议</h2>
                <div className="space-y-3">
                  {recommendations.map((rec, index) => (
                    <div key={index} className="flex items-start gap-3 bg-gray-50 rounded-lg p-4">
                      <div className="w-6 h-6 bg-dc-cold text-white rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold">
                        {index + 1}
                      </div>
                      <p className="text-gray-700 text-sm">{rec}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-12 pt-6 border-t border-gray-200 text-center text-xs text-gray-400">
                本报告由 DC-AIR 3D 自动生成 · {new Date().toLocaleString('zh-CN')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
