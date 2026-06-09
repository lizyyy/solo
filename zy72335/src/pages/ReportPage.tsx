import { useEffect, useState } from 'react'
import { FileText, Download, AlertTriangle, User, Phone, Eye, Loader2, CheckCircle, BarChart3, Shield, Users } from 'lucide-react'
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

  const getNextActionLabel = (action: string) => {
    const map: Record<string, string> = {
      contact_activity_leader: '联系活动负责人',
      contact_coach: '联系竞赛教练唐老师',
      no_action: '无需行动',
    }
    return map[action] || action
  }

  const getReviewStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      pending: '待复核',
      confirmed: '已通过',
      rejected: '已退回',
    }
    return map[status] || status
  }

  const getReviewStatusVariant = (status: string) => {
    const map: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'pending'> = {
      pending: 'pending',
      confirmed: 'success',
      rejected: 'danger',
    }
    return map[status] || 'info'
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
          className="flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
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
                          {formatDate(report.createdAt)}
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
              <div className="max-w-none space-y-8 overflow-y-auto p-4 max-h-[750px]">
                {/* 标题区 */}
                <div className="text-center border-b border-slate-200 pb-6">
                  <h1 className="font-heading text-3xl font-bold text-primary">
                    {selectedReport.title}
                  </h1>
                  <p className="mt-2 text-sm text-slate-500">
                    生成时间：{formatDate(selectedReport.generatedAt || selectedReport.createdAt)}
                  </p>
                  <div className="mt-4 flex justify-center">
                    <StatusBadge variant="success">
                      <CheckCircle size={12} className="mr-1" />
                      报告已生成
                    </StatusBadge>
                  </div>
                </div>

                {/* 统计卡片 */}
                <div className="grid grid-cols-5 gap-3">
                  <div className="rounded-lg bg-slate-50 p-3 text-center">
                    <BarChart3 size={18} className="mx-auto mb-1 text-slate-500" />
                    <p className="text-xs text-slate-500">总行数</p>
                    <p className="text-xl font-bold text-primary">{selectedReport.summary.totalRows}</p>
                  </div>
                  <div className="rounded-lg bg-emerald-50 p-3 text-center">
                    <CheckCircle size={18} className="mx-auto mb-1 text-emerald-600" />
                    <p className="text-xs text-slate-500">已保留</p>
                    <p className="text-xl font-bold text-emerald-600">{selectedReport.summary.keptCount}</p>
                  </div>
                  <div className="rounded-lg bg-amber-50 p-3 text-center">
                    <AlertTriangle size={18} className="mx-auto mb-1 text-amber-600" />
                    <p className="text-xs text-slate-500">格式标记</p>
                    <p className="text-xl font-bold text-amber-600">{selectedReport.summary.flaggedCount}</p>
                  </div>
                  <div className="rounded-lg bg-rose-50 p-3 text-center">
                    <Shield size={18} className="mx-auto mb-1 text-rose-600" />
                    <p className="text-xs text-slate-500">缺失材料</p>
                    <p className="text-xl font-bold text-rose-600">{selectedReport.summary.missingCount}</p>
                  </div>
                  <div className="rounded-lg bg-blue-50 p-3 text-center">
                    <Users size={18} className="mx-auto mb-1 text-blue-600" />
                    <p className="text-xs text-slate-500">待行动</p>
                    <p className="text-xl font-bold text-blue-600">{selectedReport.summary.actionRequiredCount}</p>
                  </div>
                </div>

                {/* 一、总览说明 */}
                <div className="space-y-4">
                  <h2 className="font-heading text-2xl font-bold text-primary">
                    一、总览说明
                  </h2>
                  <div className="rounded-lg border-l-4 border-l-primary bg-slate-50 p-4">
                    <p className="leading-relaxed text-slate-700">
                      本报告汇总了本次模拟退火座位安排的数据复核结果。其中
                      <span className="font-semibold text-emerald-700"> {selectedReport.summary.keptCount} 条记录保留</span>
                      ；
                      <span className="font-semibold text-amber-700"> {selectedReport.summary.flaggedCount} 条记录因百分数与小数混合格式需人工复核</span>
                      ；
                      <span className="font-semibold text-rose-700"> {selectedReport.summary.missingCount} 条记录缺失关键材料</span>
                      ；
                      <span className="font-semibold text-blue-700"> {selectedReport.summary.actionRequiredCount} 条记录需要后续跟进</span>
                      。请活动负责人与竞赛教练唐老师按章节分别处理。
                    </p>
                  </div>
                </div>

                {/* 二、已保留项目及保留原因 */}
                <div className="space-y-4">
                  <h2 className="font-heading text-2xl font-bold text-primary">
                    二、已保留项目及保留原因
                  </h2>
                  {selectedReport.sections.keptItems.length === 0 ? (
                    <p className="text-slate-400">暂无保留项目</p>
                  ) : (
                    <ol className="space-y-4 pl-5">
                      {selectedReport.sections.keptItems.map((item, idx) => (
                        <li key={item.id} className="space-y-2">
                          <div className="font-medium text-slate-800">
                            {idx + 1}. {item.content}
                          </div>
                          <blockquote className="ml-4 border-l-4 border-l-accent bg-amber-50 py-2 pl-4 pr-3 text-sm text-slate-600 rounded-r">
                            <div className="flex items-start gap-2">
                              <AlertTriangle size={14} className="mt-0.5 flex-shrink-0 text-accent" />
                              <div>
                                <span className="font-semibold">保留原因：</span>
                                <span>{item.keepReason}</span>
                                {item.boundary && (
                                  <div className="mt-1 text-xs text-slate-500">
                                    已补边界值：<span className="font-mono">{item.boundary.fieldName}</span>
                                    {item.boundary.minValue != null && item.boundary.maxValue != null && (
                                      <>
                                        {' 范围：'}
                                        <span className="font-mono">
                                          [{item.boundary.minValue} - {item.boundary.maxValue}]
                                        </span>
                                        {item.boundary.unit && <span> {item.boundary.unit}</span>}
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </blockquote>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>

                {/* 三、格式异常待人工复核 */}
                <div className="space-y-4">
                  <h2 className="font-heading text-2xl font-bold text-primary">
                    三、格式异常（百分数/小数混合）待人工复核
                  </h2>
                  <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3">
                    <AlertTriangle size={18} className="mt-0.5 flex-shrink-0 text-amber-500" />
                    <p className="text-xs text-amber-700">
                      <strong>重要提示：</strong>以下记录的百分数和小数值同时存在，请勿自动归为正常，需由
                      <strong>活动负责人</strong>人工核对后决定是否通过。
                    </p>
                  </div>
                  {selectedReport.sections.flaggedItems.length === 0 ? (
                    <p className="text-slate-400">暂无格式异常记录</p>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                      <table className="w-full">
                        <thead>
                          <tr>
                            <th className="table-header">#</th>
                            <th className="table-header">内容</th>
                            <th className="table-header">百分数值</th>
                            <th className="table-header">小数值</th>
                            <th className="table-header">复核状态</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedReport.sections.flaggedItems.map((item, idx) => (
                            <tr key={item.id} className="row-mixed">
                              <td className="table-cell">{idx + 1}</td>
                              <td className="table-cell max-w-xs truncate">{item.content}</td>
                              <td className="table-cell font-mono text-xs">{item.percentageValue || '-'}</td>
                              <td className="table-cell font-mono text-xs">{item.decimalValue || '-'}</td>
                              <td className="table-cell">
                                <StatusBadge variant={getReviewStatusVariant(item.reviewStatus)}>
                                  {getReviewStatusLabel(item.reviewStatus)}
                                </StatusBadge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* 四、缺失材料清单 */}
                <div className="space-y-4">
                  <h2 className="font-heading text-2xl font-bold text-primary">
                    四、缺失材料清单
                  </h2>
                  {selectedReport.sections.missingMaterials.length === 0 ? (
                    <div className="rounded-lg bg-emerald-50 p-4 text-center">
                      <CheckCircle size={24} className="mx-auto mb-2 text-emerald-600" />
                      <p className="text-emerald-700">所有材料均已齐全</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedReport.sections.missingMaterials.map((item, idx) => (
                        <div
                          key={item.id}
                          className="flex items-start gap-3 rounded-lg bg-amber-50 p-4"
                        >
                          <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-accent/20 text-sm font-bold text-accent">
                            {idx + 1}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-amber-800">
                              关联记录：{item.content}
                            </p>
                            <p className="mt-1 text-sm text-amber-700">
                              <strong>还需补充：</strong>
                            </p>
                            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-amber-700">
                              {item.missingMaterials.map((mat, i) => (
                                <li key={i}>{mat}</li>
                              ))}
                            </ul>
                            <p className="mt-2 text-xs text-amber-600">
                              请尽快补充上述材料以确保审核通过
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 五、后续行动安排 */}
                <div className="space-y-4">
                  <h2 className="font-heading text-2xl font-bold text-primary">
                    五、后续行动安排
                  </h2>
                  {selectedReport.sections.nextActions.length === 0 ? (
                    <div className="rounded-lg bg-emerald-50 p-4 text-center">
                      <CheckCircle size={24} className="mx-auto mb-2 text-emerald-600" />
                      <p className="text-emerald-700">无需后续行动</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedReport.sections.nextActions.map((item, index) => {
                        const action = item.nextAction
                        const isCoach = action === 'contact_coach' || action.includes('coach')
                        const isLeader = action === 'contact_activity_leader' || action.includes('leader')

                        return (
                          <div
                            key={item.id}
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
                                  行动 #{index + 1}：{getNextActionLabel(action)}
                                </p>
                                <p className="mt-1 text-sm text-slate-600">
                                  涉及记录：<span className="font-medium">{item.content}</span>
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {isLeader
                                    ? '请活动负责人核对百分数/小数等格式问题，并在系统内做出确认或退回决定。'
                                    : isCoach
                                    ? '请竞赛教练唐老师补充边界值说明或复核备注信息。'
                                    : '请按相关流程处理。'}
                                </p>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* 结束 */}
                <div className="pt-6 text-center text-sm text-slate-400 border-t border-slate-200">
                  <p>— 报告结束，请按分工及时处理 —</p>
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
