import React, { useState, useRef } from 'react'
import { useStore } from '../store/useStore'
import { ArrowLeft, FileText, Download, FileJson, FileSpreadsheet } from 'lucide-react'
import { getIssueTypeName, getStatusName } from '../utils/detection'
import jsPDF from 'jspdf'
import * as XLSX from 'xlsx'

export const ExportPage = () => {
  const { 
    currentProject, 
    currentVersion,
    issues,
    setCurrentPage,
    exportProjectData
  } = useStore()
  
  const reportRef = useRef<HTMLDivElement>(null)
  const [exporting, setExporting] = useState(false)
  
  const versionIssues = currentVersion
    ? issues.filter(i => i.versionId === currentVersion.id)
    : []
  
  const pendingCount = versionIssues.filter(i => i.status === 'PENDING').length
  const confirmedCount = versionIssues.filter(i => i.status === 'CONFIRMED').length
  const resolvedCount = versionIssues.filter(i => i.status === 'RESOLVED').length
  const dismissedCount = versionIssues.filter(i => i.status === 'DISMISSED').length
  
  const exportToJSON = () => {
    const data = exportProjectData()
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `巡检报告_${currentProject?.name || '项目'}_${new Date().toLocaleDateString()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
  
  const exportToExcel = () => {
    const data = versionIssues.map(issue => {
      const model = currentVersion?.models.find(m => m.id === issue.modelId)
      return {
        '问题类型': getIssueTypeName(issue.type),
        '状态': getStatusName(issue.status),
        '相关模型': model?.name || '-',
        '检测原因': issue.reason,
        '下一步': issue.nextStep,
        '创建时间': new Date(issue.createdAt).toLocaleString()
      }
    })
    
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(data)
    XLSX.utils.book_append_sheet(wb, ws, '巡检问题')
    XLSX.writeFile(wb, `巡检报告_${currentProject?.name || '项目'}_${new Date().toLocaleDateString()}.xlsx`)
  }
  
  const exportToPDF = async () => {
    setExporting(true)
    
    try {
      const doc = new jsPDF('p', 'mm', 'a4')
      
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(20)
      doc.text('地下管廊巡检报告', 105, 30, { align: 'center' })
      
      doc.setFontSize(12)
      doc.setFont('helvetica', 'normal')
      doc.text(`项目名称: ${currentProject?.name || '-'}`, 20, 50)
      doc.text(`版本名称: ${currentVersion?.name || '-'}`, 20, 60)
      doc.text(`导出时间: ${new Date().toLocaleString()}`, 20, 70)
      
      doc.text(`问题总数: ${versionIssues.length}`, 20, 85)
      doc.text(`待确认: ${pendingCount}`, 20, 95)
      doc.text(`已确认: ${confirmedCount}`, 20, 105)
      doc.text(`已解决: ${resolvedCount}`, 20, 115)
      doc.text(`无问题: ${dismissedCount}`, 20, 125)
      
      doc.addPage()
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(16)
      doc.text('问题清单', 20, 20)
      
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      
      let y = 35
      versionIssues.forEach((issue, index) => {
        if (y > 270) {
          doc.addPage()
          y = 20
        }
        
        const model = currentVersion?.models.find(m => m.id === issue.modelId)
        doc.text(`${index + 1}. ${getIssueTypeName(issue.type)} [${getStatusName(issue.status)}]`, 20, y)
        doc.text(`   模型: ${model?.name || '-'}`, 25, y + 7)
        
        const reasonLines = doc.splitTextToSize(issue.reason, 160)
        doc.text(`   原因: ${reasonLines[0]}`, 25, y + 14)
        if (reasonLines.length > 1) {
          doc.text(`         ${reasonLines.slice(1).join(' ')}`, 25, y + 21)
          y += 7
        }
        
        const stepLines = doc.splitTextToSize(issue.nextStep, 160)
        doc.text(`   下一步: ${stepLines[0]}`, 25, y + 28)
        if (stepLines.length > 1) {
          doc.text(`           ${stepLines.slice(1).join(' ')}`, 25, y + 35)
          y += 7
        }
        
        y += 42
      })
      
      doc.save(`巡检报告_${currentProject?.name || '项目'}_${new Date().toLocaleDateString()}.pdf`)
    } catch (error) {
      console.error('PDF导出失败:', error)
      alert('PDF导出失败，请重试')
    }
    
    setExporting(false)
  }
  
  return (
    <div className="h-full bg-slate-100 flex flex-col">
      <header className="bg-white shadow-sm px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setCurrentPage('history')}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-800">导出报告</h1>
              <p className="text-sm text-slate-500">
                {currentProject?.name || '未选择项目'}
              </p>
            </div>
          </div>
        </div>
      </header>
      
      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-3 gap-4 mb-6">
            <button
              onClick={exportToPDF}
              disabled={exporting || !currentVersion}
              className="p-6 bg-white rounded-xl border border-slate-200 hover:border-secondary hover:shadow-md transition-all text-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileText className="w-12 h-12 text-red-500 mx-auto mb-3" />
              <h3 className="font-semibold text-slate-800">导出 PDF</h3>
              <p className="text-sm text-slate-500 mt-1">适合打印和分享</p>
            </button>
            
            <button
              onClick={exportToExcel}
              disabled={!currentVersion}
              className="p-6 bg-white rounded-xl border border-slate-200 hover:border-secondary hover:shadow-md transition-all text-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileSpreadsheet className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <h3 className="font-semibold text-slate-800">导出 Excel</h3>
              <p className="text-sm text-slate-500 mt-1">适合数据统计分析</p>
            </button>
            
            <button
              onClick={exportToJSON}
              disabled={!currentVersion}
              className="p-6 bg-white rounded-xl border border-slate-200 hover:border-secondary hover:shadow-md transition-all text-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileJson className="w-12 h-12 text-blue-500 mx-auto mb-3" />
              <h3 className="font-semibold text-slate-800">导出 JSON</h3>
              <p className="text-sm text-slate-500 mt-1">完整项目数据备份</p>
            </button>
          </div>
          
          <div ref={reportRef} className="bg-white rounded-xl border border-slate-200 p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-slate-800">地下管廊巡检报告</h2>
              <p className="text-slate-500 mt-2">
                {currentProject?.name || '未命名项目'} - {currentVersion?.name || '未命名版本'}
              </p>
            </div>
            
            <div className="grid grid-cols-4 gap-4 mb-8">
              <div className="bg-slate-50 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-slate-800">{versionIssues.length}</p>
                <p className="text-sm text-slate-500">问题总数</p>
              </div>
              <div className="bg-yellow-50 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-yellow-600">{pendingCount}</p>
                <p className="text-sm text-slate-500">待确认</p>
              </div>
              <div className="bg-red-50 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-red-600">{confirmedCount}</p>
                <p className="text-sm text-slate-500">已确认</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-green-600">{resolvedCount}</p>
                <p className="text-sm text-slate-500">已解决</p>
              </div>
            </div>
            
            <h3 className="text-lg font-semibold text-slate-800 mb-4">问题清单</h3>
            
            {versionIssues.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                暂无问题记录
              </div>
            ) : (
              <div className="space-y-4">
                {versionIssues.map((issue, index) => {
                  const model = currentVersion?.models.find(m => m.id === issue.modelId)
                  return (
                    <div key={issue.id} className="border border-slate-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 bg-secondary text-white rounded-full flex items-center justify-center font-bold text-sm">
                            {index + 1}
                          </span>
                          <h4 className="font-medium text-slate-800">
                            {getIssueTypeName(issue.type)}
                          </h4>
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            issue.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                            issue.status === 'CONFIRMED' ? 'bg-red-100 text-red-700' :
                            issue.status === 'RESOLVED' ? 'bg-green-100 text-green-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {getStatusName(issue.status)}
                          </span>
                        </div>
                        <span className="text-sm text-slate-500">
                          {model?.name || '-'}
                        </span>
                      </div>
                      
                      <div className="space-y-2 ml-11">
                        <div>
                          <p className="text-xs font-medium text-slate-600">检测原因:</p>
                          <p className="text-sm text-slate-700">{issue.reason}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-secondary">下一步:</p>
                          <p className="text-sm text-slate-700">{issue.nextStep}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            
            <div className="mt-8 pt-4 border-t border-slate-200 text-center text-sm text-slate-500">
              报告生成时间: {new Date().toLocaleString()}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
