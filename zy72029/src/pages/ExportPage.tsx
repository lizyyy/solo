import { useLocation, useNavigate } from 'react-router-dom'
import type { GameResult } from '@/types'
import { exportToJSON, exportToCSV, printHTMLReport, generateHTMLReport, saveToLocalStorage } from '@/utils/export'
import { ArrowLeft, Download, FileJson, FileSpreadsheet, Printer, HardDrive, CheckCircle2 } from 'lucide-react'
import { useState } from 'react'

export default function ExportPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [exportSuccess, setExportSuccess] = useState<string | null>(null)

  const result = location.state?.result as GameResult

  if (!result) {
    return (
      <div className="min-h-screen bg-charcoal flex items-center justify-center">
        <div className="text-center">
          <p className="text-paper-cream mb-4">未找到练习结果数据</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-calm-blue text-charcoal font-mono"
          >
            返回首页
          </button>
        </div>
      </div>
    )
  }

  const formatDateTime = (isoString: string) => {
    return new Date(isoString).toLocaleString('zh-CN')
  }

  const handleExport = (type: 'json' | 'csv' | 'print' | 'save' | 'html') => {
    if (type === 'json') {
      exportToJSON(result)
      setExportSuccess('JSON 文件已下载')
    } else if (type === 'csv') {
      exportToCSV(result)
      setExportSuccess('CSV 文件已下载')
    } else if (type === 'print') {
      printHTMLReport(result)
      return
    } else if (type === 'save') {
      saveToLocalStorage(result)
      setExportSuccess('已保存到本地存储')
    } else if (type === 'html') {
      const html = generateHTMLReport(result)
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `保险理赔逃脱屋_${result.sessionId}_完整报告.html`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      setExportSuccess('HTML 报告已下载')
    }
    setTimeout(() => setExportSuccess(null), 3000)
  }

  return (
    <div className="min-h-screen bg-charcoal">
      <div className="max-w-5xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/result', { state: { result } })}
            className="flex items-center gap-2 text-white/60 hover:text-paper-cream transition-colors"
          >
            <ArrowLeft size={18} />
            返回结果分析
          </button>

          {exportSuccess && (
            <span className="text-success-green font-mono text-sm flex items-center gap-2">
              <CheckCircle2 size={16} />
              {exportSuccess}
            </span>
          )}
        </div>

        <div className="text-center mb-8">
          <h1 className="font-mono text-3xl font-bold text-paper-cream mb-2">
            完整报告导出
          </h1>
          <p className="text-white/50">
            会话ID: <span className="font-mono">{result.sessionId}</span>
          </p>
        </div>

        <div className="bg-paper-cream text-charcoal p-6 mb-6 border-2 border-success-green">
          <div className="flex items-start gap-4 mb-6">
            <div className="p-3 bg-success-green/20 rounded-full">
              <CheckCircle2 size={32} className="text-success-green" />
            </div>
            <div className="flex-1">
              <h2 className="font-mono text-xl font-bold mb-2">
                📋 交接信息摘要
              </h2>
              <p className="text-charcoal/70 text-sm mb-4">
                本报告包含完整的操作痕迹，可直接用于工作交接，无需再从学生练习记录重新找证据。
              </p>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex">
                  <span className="text-charcoal/50 min-w-[100px] font-medium">材料来源：</span>
                  <span className="font-mono">{result.exportMetadata.materialSource}</span>
                </div>
                <div className="flex">
                  <span className="text-charcoal/50 min-w-[100px] font-medium">处理人：</span>
                  <span className="font-mono">{result.exportMetadata.handler}</span>
                </div>
                <div className="flex">
                  <span className="text-charcoal/50 min-w-[100px] font-medium">学生姓名：</span>
                  <span className="font-mono">{result.studentName || '未填写'}</span>
                </div>
                <div className="flex">
                  <span className="text-charcoal/50 min-w-[100px] font-medium">材料包：</span>
                  <span className="font-mono">{result.materialPack?.name || '-'}</span>
                </div>
                <div className="flex">
                  <span className="text-charcoal/50 min-w-[100px] font-medium">开始时间：</span>
                  <span className="font-mono">{formatDateTime(result.exportMetadata.processingStartTime)}</span>
                </div>
                <div className="flex">
                  <span className="text-charcoal/50 min-w-[100px] font-medium">结束时间：</span>
                  <span className="font-mono">{formatDateTime(result.exportMetadata.processingEndTime)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-success-green/10 border-l-4 border-success-green p-4">
            <h3 className="font-mono font-bold text-sm mb-2">关键判定点（交接时无需再问）</h3>
            <ul className="space-y-1 text-sm">
              {result.exportMetadata.keyDecisions.map((d, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-success-green font-mono">{i + 1}.</span>
                  {d}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-8">
          <div className="bg-white/5 border border-white/10 p-6">
            <h3 className="font-mono font-bold text-lg text-paper-cream mb-4">
              导出格式选择
            </h3>
            <p className="text-white/50 text-sm mb-6">
              所有导出格式都会保留完整的操作记录、原始备注、失败原因和补录备注差异，
              不会为了整齐而洗掉任何"乱备注"。
            </p>

            <div className="space-y-3">
              <button
                onClick={() => handleExport('json')}
                className="w-full flex items-center gap-4 p-4 bg-white/5 border border-white/20 
                  hover:bg-white/10 hover:border-calm-blue/50 transition-all group"
              >
                <div className="p-2 bg-calm-blue/20 group-hover:bg-calm-blue/30 transition-colors">
                  <FileJson size={24} className="text-calm-blue" />
                </div>
                <div className="text-left flex-1">
                  <div className="font-mono text-paper-cream">JSON 完整数据</div>
                  <div className="text-xs text-white/50">包含所有原始数据，可用于程序处理</div>
                </div>
                <Download size={18} className="text-white/30 group-hover:text-calm-blue transition-colors" />
              </button>

              <button
                onClick={() => handleExport('csv')}
                className="w-full flex items-center gap-4 p-4 bg-white/5 border border-white/20 
                  hover:bg-white/10 hover:border-success-green/50 transition-all group"
              >
                <div className="p-2 bg-success-green/20 group-hover:bg-success-green/30 transition-colors">
                  <FileSpreadsheet size={24} className="text-success-green" />
                </div>
                <div className="text-left flex-1">
                  <div className="font-mono text-paper-cream">CSV 操作日志</div>
                  <div className="text-xs text-white/50">可直接用 Excel 打开查看</div>
                </div>
                <Download size={18} className="text-white/30 group-hover:text-success-green transition-colors" />
              </button>

              <button
                onClick={() => handleExport('html')}
                className="w-full flex items-center gap-4 p-4 bg-white/5 border border-white/20 
                  hover:bg-white/10 hover:border-warning-orange/50 transition-all group"
              >
                <div className="p-2 bg-warning-orange/20 group-hover:bg-warning-orange/30 transition-colors">
                  <FileSpreadsheet size={24} className="text-warning-orange" />
                </div>
                <div className="text-left flex-1">
                  <div className="font-mono text-paper-cream">HTML 完整报告</div>
                  <div className="text-xs text-white/50">美观的打印格式，适合存档和交接</div>
                </div>
                <Download size={18} className="text-white/30 group-hover:text-warning-orange transition-colors" />
              </button>

              <button
                onClick={() => handleExport('print')}
                className="w-full flex items-center gap-4 p-4 bg-white/5 border border-white/20 
                  hover:bg-white/10 hover:border-purple-400/50 transition-all group"
              >
                <div className="p-2 bg-purple-400/20 group-hover:bg-purple-400/30 transition-colors">
                  <Printer size={24} className="text-purple-400" />
                </div>
                <div className="text-left flex-1">
                  <div className="font-mono text-paper-cream">直接打印</div>
                  <div className="text-xs text-white/50">打开打印预览，可直接打印或另存为PDF</div>
                </div>
                <Download size={18} className="text-white/30 group-hover:text-purple-400 transition-colors" />
              </button>

              <button
                onClick={() => handleExport('save')}
                className="w-full flex items-center gap-4 p-4 bg-white/5 border border-white/20 
                  hover:bg-white/10 hover:border-white/40 transition-all group"
              >
                <div className="p-2 bg-white/10 group-hover:bg-white/20 transition-colors">
                  <HardDrive size={24} className="text-white/70" />
                </div>
                <div className="text-left flex-1">
                  <div className="font-mono text-paper-cream">保存到本地存储</div>
                  <div className="text-xs text-white/50">保存在浏览器中，下次可继续查看</div>
                </div>
                <CheckCircle2 size={18} className="text-white/30 group-hover:text-white/70 transition-colors" />
              </button>
            </div>
          </div>

          <div className="bg-warning-orange/5 border border-warning-orange/30 p-6">
            <h3 className="font-mono font-bold text-lg text-warning-orange mb-4">
              ⚠️ 导出内容说明
            </h3>

            <div className="space-y-4 text-sm">
              <div className="p-3 bg-white/5">
                <div className="font-mono font-medium text-paper-cream mb-1">✓ 保留的内容</div>
                <ul className="text-white/70 space-y-1 text-xs">
                  <li>• 所有操作记录（放置、移除、点击）</li>
                  <li>• 学生原始备注（不做任何清洗）</li>
                  <li>• 失败原因诊断（规则理解错误/操作超时）</li>
                  <li>• 暂停记录（含故意打断标记）</li>
                  <li>• 补录备注（带差异标记）</li>
                  <li>• 材料来源和处理时间</li>
                  <li>• 关键判定理由</li>
                </ul>
              </div>

              <div className="p-3 bg-white/5">
                <div className="font-mono font-medium text-paper-cream mb-1">✗ 不会清洗的内容</div>
                <ul className="text-white/70 space-y-1 text-xs">
                  <li>• 学生写的"乱备注"原样保留</li>
                  <li>• 新手误操作记录不删除</li>
                  <li>• 边界分数场景标记保留</li>
                  <li>• 暂停打断记录完整保留</li>
                </ul>
              </div>

              <div className="p-3 bg-calm-blue/10 border border-calm-blue/30">
                <div className="font-mono font-medium text-calm-blue mb-1">💡 交接提示</div>
                <p className="text-white/70 text-xs">
                  导出的报告包含"关键判定"部分，明确列出了材料来源、处理时间、
                  失败原因判定依据等信息。别人接手时直接看这部分即可，
                  无需再问小夏"这条为什么这么判"。
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center py-6 text-white/30 text-xs border-t border-white/10">
          <p>保险理赔逃脱屋 · 专为科普馆讲解员小夏定制</p>
          <p className="mt-1">所有数据仅保存在本地浏览器，不会上传到任何服务器</p>
        </div>
      </div>
    </div>
  )
}
