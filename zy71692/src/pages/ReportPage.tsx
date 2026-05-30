import { useState, useCallback } from 'react'
import { FileDown, FileJson, Edit2, Save, Download } from 'lucide-react'
import { useClassroomStore } from '@/store'
import Layout from '@/components/Layout'
import { exportAllData } from '@/db'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

export default function ReportPage() {
  const {
    projectName,
    skeletonDefinition,
    clips,
    keyframes,
    comments,
    getReportSummary,
  } = useClassroomStore()

  const [notes, setNotes] = useState<Record<string, string>>({
    overview: '',
    anomalies: '',
    recommendations: '',
  })
  const [editingSection, setEditingSection] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  const summary = getReportSummary()

  const handleExportJson = useCallback(async () => {
    const json = await exportAllData('demo-project-001')
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `motion-classroom-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const handleExportPdf = useCallback(async () => {
    setIsExporting(true)
    try {
      const element = document.getElementById('report-content')
      if (!element) return
      const canvas = await html2canvas(element, { backgroundColor: '#111827', scale: 2 })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      const imgWidth = 210
      const pageHeight = 297
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      let heightLeft = imgHeight
      let position = 0
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }
      pdf.save(`motion-report-${Date.now()}.pdf`)
    } finally {
      setIsExporting(false)
    }
  }, [])

  const NoteSection = ({
    section,
    title,
  }: {
    section: string
    title: string
  }) => (
    <div className="p-4 rounded-lg bg-gray-800">
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-sm font-medium text-gray-300">{title}</h4>
        {editingSection === section ? (
          <button
            onClick={() => setEditingSection(null)}
            className="p-1 text-teal-400 hover:text-teal-300"
          >
            <Save size={14} />
          </button>
        ) : (
          <button
            onClick={() => setEditingSection(section)}
            className="p-1 text-gray-500 hover:text-gray-300"
          >
            <Edit2 size={14} />
          </button>
        )}
      </div>
      {editingSection === section ? (
        <textarea
          autoFocus
          value={notes[section]}
          onChange={(e) =>
            setNotes((prev) => ({ ...prev, [section]: e.target.value }))
          }
          onBlur={() => setEditingSection(null)}
          className="w-full h-24 px-3 py-2 text-sm rounded bg-gray-900 border border-gray-700 text-gray-200 resize-none"
          placeholder="添加备注..."
        />
      ) : (
        <p className="text-sm text-gray-400">{notes[section] || '暂无备注，点击编辑'}</p>
      )}
    </div>
  )

  return (
    <Layout>
      <div className="h-full p-6 overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-100">课堂报告</h2>
          <div className="flex gap-2">
            <button
              onClick={handleExportJson}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm"
            >
              <FileJson size={16} />
              导出 JSON
            </button>
            <button
              onClick={handleExportPdf}
              disabled={isExporting}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:bg-teal-800 text-white text-sm"
            >
              <Download size={16} />
              {isExporting ? '导出中...' : '导出 PDF'}
            </button>
          </div>
        </div>
        <div id="report-content" className="max-w-4xl space-y-6">
          <div className="p-6 rounded-xl bg-gray-900 border border-gray-800">
            <div className="flex items-center gap-3 mb-4">
              <FileDown size={24} className="text-teal-400" />
              <div>
                <h3 className="text-lg font-semibold text-gray-100">{projectName || '课堂报告'}</h3>
                <p className="text-sm text-gray-500">生成时间: {new Date().toLocaleString('zh-CN')}</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-gray-900 border border-gray-800">
              <div className="text-xs text-gray-500 mb-1">总帧数</div>
              <div className="text-2xl font-bold text-gray-100">{summary.totalFrames}</div>
            </div>
            <div className="p-4 rounded-xl bg-gray-900 border border-gray-800">
              <div className="text-xs text-gray-500 mb-1">异常次数</div>
              <div className={`text-2xl font-bold ${summary.totalAnomalies > 0 ? 'text-orange-400' : 'text-gray-100'}`}>
                {summary.totalAnomalies}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-gray-900 border border-gray-800">
              <div className="text-xs text-gray-500 mb-1">关键帧/点评</div>
              <div className="text-2xl font-bold text-gray-100">
                {summary.keyframeCount} / {summary.commentCount}
              </div>
            </div>
          </div>
          <NoteSection section="overview" title="总体评价备注" />
          <div className="p-4 rounded-xl bg-gray-900 border border-gray-800">
            <h3 className="text-sm font-medium text-gray-300 mb-4">关节角度分析</h3>
            <div className="grid grid-cols-2 gap-4">
              {skeletonDefinition.angleJoints.map((def) => {
                const avg = summary.avgAngles[def.name]
                const anomalies = summary.anomalyByJoint[def.name] ?? 0
                return (
                  <div key={def.name} className="p-3 rounded-lg bg-gray-800">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-gray-300">{def.label}</span>
                      <span className={`text-xs ${anomalies > 0 ? 'text-red-400' : 'text-gray-500'}`}>
                        {anomalies} 异常
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-bold text-gray-100">{avg?.toFixed(1) ?? '-'}</span>
                      <span className="text-xs text-gray-500">° (平均)</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <NoteSection section="anomalies" title="异常情况备注" />
          <div className="p-4 rounded-xl bg-gray-900 border border-gray-800">
            <h3 className="text-sm font-medium text-gray-300 mb-4">异常日志摘要</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {clips.flatMap((c) => c.anomalyLog).length === 0 ? (
                <div className="text-xs text-gray-500">无异常</div>
              ) : (
                clips
                  .flatMap((c) => c.anomalyLog.slice(0, 5))
                  .map((entry, i) => (
                    <div key={i} className="text-xs p-2 rounded bg-gray-800 border-l-2 border-orange-500">
                      <span className="text-gray-400">帧 #{entry.frameIndex + 1}</span>
                      <span className="ml-2 text-gray-300">{entry.detail}</span>
                    </div>
                  ))
              )}
            </div>
          </div>
          <div className="p-4 rounded-xl bg-gray-900 border border-gray-800">
            <h3 className="text-sm font-medium text-gray-300 mb-4">关键帧标注</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {keyframes.length === 0 ? (
                <div className="text-xs text-gray-500">无关键帧</div>
              ) : (
                keyframes.slice(0, 10).map((kf) => (
                  <div key={kf.id} className="flex justify-between text-xs p-2 rounded bg-gray-800">
                    <span className="text-gray-300">{kf.label}</span>
                    <span className="text-gray-500">帧 #{kf.frameIndex + 1} ({kf.source === 'auto' ? '自动' : '手动'})</span>
                  </div>
                ))
              )}
            </div>
          </div>
          <NoteSection section="recommendations" title="改进建议备注" />
        </div>
      </div>
    </Layout>
  )
}
