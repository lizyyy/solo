import { useEffect, useState } from 'react'
import { FileText, Download, AlertTriangle, User, Phone, Trash2, Eye, Loader2, CheckCircle } from 'lucide-react'
import { useAppStore, type Report } from '@/store'
import StatusBadge from '@/components/StatusBadge'

export default function ReportPage() {
  const { reports, fetchReports, generateReport, getReport } = useAppStore()
  const [isGenerating, setIsGenerating] = useState(false)
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)
  const [isLoadingReport, setIsLoadingReport] = useState(false)
  const [showToast, setShowToast] = useState(false)

  useEffect(() => {
    fetchReports()
  }, [fetchReports])

  const handleGenerateReport = async () => {
    setIsGenerating(true)
    try {
      const report = await generateReport()
      setSelectedReport(report)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleViewReport = async (reportId: string) => {
    setIsLoadingReport(true)
    try {
      const report = await getReport(reportId)
      setSelectedReport(report)
    } finally {
      setIsLoadingReport(false)
    }
  }

  const handleDeleteReport = (reportId: string) => {
    console.log('Delete report:', reportId)
  }

  const handleDownload = () => {
    setShowToast(true)
    setTimeout(() => setShowToast(false), 3000)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold text-primary">
          报告生成
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          生成、查看和导出座位安排复核结果报告
        </p>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleGenerateReport}
          disabled={isGenerating}
          className="flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-accent-light disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isGenerating ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <FileText size={16} />
          )}
          {isGenerating ? '正在生成...' : '生成最新报告'}
        </button>
      </div>

      <div className="grid grid-cols-5 gap-6">
        <div className="col-span-2 space-y-4">
          <h2 className="font-heading text-xl font-semibold text-primary">
            已生成报告列表
          </h2>
          <div className="card">
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header">报告标题</th>
                    <th className="table-header">生成时间</th>
                    <th className="table-header">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-sm text-slate-500">
                        暂无报告，请先生成
                      </td>
                    </tr>
                  ) : (
                    reports.map((report) => (
                      <tr
                        key={report.id}
                        className={`transition-colors hover:bg-slate-50 ${
                          selectedReport?.id === report.id ? 'bg-blue-50' : ''
                        }`}
                      >
                        <td className="table-cell">
                          <div className="flex items-center gap-2">
                            <FileText size={14} className="text-slate-400" />
                            <span className="font-medium">{report.title}</span>
                          </div>
                        </td>
                        <td className="table-cell text-slate-500">
                          {formatDate(report.created_at)}
                        </td>
                        <td className="table-cell">
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleViewReport(report.id)}
                              className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary"
                              title="查看"
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteReport(report.id)}
                              className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-danger"
                              title="删除"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-xl font-semibold text-primary">
              报告预览
            </h2>
            {selectedReport && (
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
              >
                <Download size={16} />
                下载报告
              </button>
            )}
          </div>

          <div className="card min-h-[600px]">
            {isLoadingReport ? (
              <div className="flex h-[600px] items-center justify-center">
                <Loader2 size={32} className="animate-spin text-accent" />
              </div>
            ) : !selectedReport ? (
              <div className="flex h-[600px] flex-col items-center justify-center text-slate-400">
                <FileText size={48} className="mb-4 opacity-50" />
                <p className="text-lg font-medium">请选择或生成报告</p>
                <p className="mt-1 text-sm text-slate-400">
                  点击左侧列表查看或生成新的报告
                </p>
              </div>
            ) : (
              <div className="max-w-none space-y-8 p-4">
                <div className="text-center">
                  <h1 className="font-heading text-3xl font-bold text-primary">
                    {selectedReport.title}
                  </h1>
                  <p className="mt-2 text-sm text-slate-500">
                    生成时间：{formatDate(selectedReport.created_at)}
                  </p>
                  <div className="mt-4 flex justify-center">
                    <StatusBadge variant="success">
                      <CheckCircle size={12} className="mr-1" />
                      报告已生成
                    </StatusBadge>
                  </div>
                </div>

                <hr className="border-slate-200" />

                {selectedReport.sections.map((section, sectionIndex) => (
                  <div key={sectionIndex} className="space-y-4">
                    <h2 className="font-heading text-2xl font-bold text-primary">
                      {section.heading}
                    </h2>

                    <p className="leading-relaxed text-slate-700">
                      {section.content}
                    </p>

                    {section.keptItems.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="font-heading text-lg font-semibold text-primary">
                          已保留项目
                        </h3>
                        <ol className="space-y-4 pl-5">
                          {section.keptItems.map((item, itemIndex) => (
                            <li key={item.id} className="space-y-2">
                              <div className="font-medium text-slate-800">
                                {itemIndex + 1}. {item.content}
                              </div>
                              <blockquote className="ml-4 border-l-4 border-accent bg-amber-50 py-2 pl-4 pr-3 text-sm text-slate-600">
                                <div className="flex items-start gap-2">
                                  <AlertTriangle size={14} className="mt-0.5 flex-shrink-0 text-accent" />
                                  <span>{item.reason}</span>
                                </div>
                              </blockquote>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {section.missingMaterials.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="font-heading text-lg font-semibold text-primary">
                          缺失材料
                        </h3>
                        <div className="space-y-2">
                          {section.missingMaterials.map((material, index) => (
                            <div
                              key={index}
                              className="flex items-start gap-3 rounded-lg bg-amber-50 p-4"
                            >
                              <AlertTriangle size={18} className="mt-0.5 flex-shrink-0 text-accent" />
                              <div>
                                <p className="font-medium text-amber-800">
                                  {material}
                                </p>
                                <p className="mt-1 text-sm text-amber-600">
                                  请尽快补充上述材料以确保审核通过
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {section.nextActions.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="font-heading text-lg font-semibold text-primary">
                          后续行动
                        </h3>
                        <div className="space-y-3">
                          {section.nextActions.map((action, index) => {
                            const isCoach = action.target === 'contact_coach' || action.target.includes('唐老师')
                            const isLeader = action.target === 'contact_activity_leader' || action.target.includes('活动负责人')

                            return (
                              <div
                                key={index}
                                className={`rounded-lg border-l-4 bg-white p-4 shadow-sm ${
                                  isCoach
                                    ? 'border-l-primary'
                                    : isLeader
                                    ? 'border-l-accent'
                                    : 'border-l-slate-300'
                                }`}
                              >
                                <div className="flex items-start gap-3">
                                  <div
                                    className={`flex h-10 w-10 items-center justify-center rounded-full ${
                                      isCoach
                                        ? 'bg-primary/10 text-primary'
                                        : isLeader
                                        ? 'bg-accent/10 text-accent'
                                        : 'bg-slate-100 text-slate-600'
                                    }`}
                                  >
                                    {isCoach ? <Phone size={18} /> : <User size={18} />}
                                  </div>
                                  <div className="flex-1">
                                    <p className="font-medium text-slate-800">
                                      {isLeader ? '联系活动负责人' : isCoach ? '联系竞赛教练唐老师' : action.target}
                                    </p>
                                    <p className="mt-1 text-sm text-slate-600">
                                      {action.action}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                <div className="pt-8 text-center text-sm text-slate-400">
                  <p>— 报告结束 —</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm text-white shadow-lg">
          <CheckCircle size={16} className="text-success" />
          报告已导出
        </div>
      )}
    </div>
  )
}
