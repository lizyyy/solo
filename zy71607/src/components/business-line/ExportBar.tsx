import { useRef, useState } from 'react'
import type { RenewalTask } from '@/types'
import { Download, FileText, Eye, X } from 'lucide-react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

interface ExportBarProps {
  task: RenewalTask
}

export default function ExportBar({ task }: ExportBarProps) {
  const [showPreview, setShowPreview] = useState(false)
  const [exporting, setExporting] = useState(false)
  const reportRef = useRef<HTMLDivElement>(null)

  const handleExport = async () => {
    if (!reportRef.current) return
    setExporting(true)
    try {
      setShowPreview(true)
      await new Promise((r) => setTimeout(r, 100))
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: '#1e293b',
        scale: 2,
      })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      const imgWidth = 210
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight)
      pdf.save(`续保报价比对_${task.customerName}_${task.plateNumber}.pdf`)
    } catch (err) {
      console.error('导出失败:', err)
    } finally {
      setExporting(false)
    }
  }

  const statusText = task.comparison.overallStatus === 'normal' ? '一致' : task.comparison.overallStatus === 'warning' ? '有差异' : '异常'

  return (
    <>
      <div className="bg-surface-800 rounded-xl border border-surface-700 p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-accent-blue/15 flex items-center justify-center">
            <FileText className="w-3.5 h-3.5 text-accent-blue" />
          </div>
          <h3 className="text-sm font-medium text-surface-200">报告导出</h3>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowPreview(true)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-surface-600 text-xs text-surface-300 hover:bg-surface-700/60 hover:text-surface-100 transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>预览报告</span>
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-accent-blue text-xs text-white font-medium hover:bg-accent-blue/90 transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{exporting ? '导出中...' : '导出PDF'}</span>
          </button>
        </div>
      </div>

      {showPreview && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-8">
          <div className="bg-surface-900 rounded-xl border border-surface-700 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-surface-700">
              <h3 className="text-sm font-medium text-surface-200">报告预览</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="text-surface-400 hover:text-surface-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div ref={reportRef} className="p-6">
              <div className="text-center mb-6">
                <h2 className="text-lg font-bold text-surface-100">车险续保报价比对报告</h2>
                <p className="text-xs text-surface-400 mt-1">
                  生成时间：{new Date().toLocaleString('zh-CN')}
                </p>
              </div>

              <div className="space-y-4">
                <div className="bg-surface-700/40 rounded-lg p-4">
                  <h4 className="text-xs font-medium text-surface-200 mb-2">基本信息</h4>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div><span className="text-surface-400">客户：</span><span className="text-surface-100">{task.customerName}</span></div>
                    <div><span className="text-surface-400">车牌：</span><span className="text-surface-100 font-mono">{task.plateNumber}</span></div>
                    <div><span className="text-surface-400">保单号：</span><span className="text-surface-100 font-mono">{task.policyId}</span></div>
                    <div><span className="text-surface-400">状态：</span><span className="text-surface-100">{statusText}</span></div>
                  </div>
                </div>

                <div className="bg-surface-700/40 rounded-lg p-4">
                  <h4 className="text-xs font-medium text-surface-200 mb-2">保单信息</h4>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div><span className="text-surface-400">上年保费：</span><span className="text-surface-100 font-mono">¥{task.policy.premium.toLocaleString()}</span></div>
                    <div><span className="text-surface-400">NCD系数：</span><span className="text-surface-100 font-mono">{task.policy.ncdCoefficient}</span></div>
                    <div><span className="text-surface-400">出险次数：</span><span className="text-surface-100">{task.claims.length}次</span></div>
                    <div><span className="text-surface-400">折扣系数：</span><span className="text-surface-100 font-mono">{task.discount.finalCoefficient}</span></div>
                  </div>
                </div>

                <div className="bg-surface-700/40 rounded-lg p-4">
                  <h4 className="text-xs font-medium text-surface-200 mb-2">比对结论</h4>
                  <p className="text-[11px] text-surface-200 leading-relaxed">{task.comparison.summary}</p>
                </div>

                {task.comparison.differences.length > 0 && (
                  <div className="bg-surface-700/40 rounded-lg p-4">
                    <h4 className="text-xs font-medium text-surface-200 mb-2">差异明细</h4>
                    <div className="space-y-2">
                      {task.comparison.differences.map((diff, i) => (
                        <div key={i} className="bg-surface-700/60 rounded-lg p-3">
                          <p className="text-[11px] text-surface-200 font-medium">{diff.field}</p>
                          <div className="grid grid-cols-2 gap-2 mt-1 text-[11px]">
                            <div><span className="text-surface-400">预期：</span><span className="text-accent-green font-mono">{diff.expected}</span></div>
                            <div><span className="text-surface-400">实际：</span><span className="text-accent-red font-mono">{diff.actual}</span></div>
                          </div>
                          <p className="text-[11px] text-surface-300 mt-1">{diff.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
