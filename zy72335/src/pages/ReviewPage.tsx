import { useState, useEffect, useMemo } from 'react'
import { ChevronRight, AlertTriangle, CheckCircle, XCircle, Eye } from 'lucide-react'
import { useAppStore, type CalculationDetail, type RawRow } from '@/store'
import StatusBadge from '@/components/StatusBadge'
import StepIndicator from '@/components/StepIndicator'

export default function ReviewPage() {
  const [activeTab, setActiveTab] = useState<'calculations' | 'mixed' | 'boundary'>('calculations')
  const [rawRowModalOpen, setRawRowModalOpen] = useState(false)
  const [boundaryModalOpen, setBoundaryModalOpen] = useState(false)
  const [selectedRawRow, setSelectedRawRow] = useState<RawRow | null>(null)
  const [selectedBoundary, setSelectedBoundary] = useState<RawRow | null>(null)

  const {
    currentOperator,
    workflowStatus,
    calculationDetails,
    rawRows,
    fetchWorkflowStatus,
    fetchCalculations,
    fetchRawRows,
    refreshCalculations,
    reviewCalculation,
    advanceWorkflow,
    getRawRow,
  } = useAppStore()

  useEffect(() => {
    fetchWorkflowStatus()
    fetchCalculations()
    fetchRawRows()
  }, [fetchWorkflowStatus, fetchCalculations, fetchRawRows])

  const steps = [
    {
      label: '问卷原始行导入',
      completed: workflowStatus?.rawRowImported ?? false,
      active: !(workflowStatus?.rawRowImported ?? false),
    },
    {
      label: '边界值说明复核',
      completed: workflowStatus?.boundaryReviewed ?? false,
      active:
        (workflowStatus?.rawRowImported ?? false) &&
        !(workflowStatus?.boundaryReviewed ?? false),
    },
    {
      label: '计算明细更新',
      completed: workflowStatus?.calculationUpdated ?? false,
      active:
        (workflowStatus?.boundaryReviewed ?? false) &&
        !(workflowStatus?.calculationUpdated ?? false),
    },
  ]

  const currentStep = useMemo(() => {
    if (!workflowStatus?.rawRowImported) return 0
    if (!workflowStatus?.boundaryReviewed) return 1
    if (!workflowStatus?.calculationUpdated) return 2
    return 3
  }, [workflowStatus])

  const handleAdvanceWorkflow = () => {
    if (currentStep === 0) {
      advanceWorkflow('rawRowImported')
    } else if (currentStep === 1) {
      advanceWorkflow('boundaryReviewed')
    } else if (currentStep === 2) {
      advanceWorkflow('calculationUpdated')
    }
  }

  const handleViewRawRow = async (rawRowId: string) => {
    const row = await getRawRow(rawRowId)
    setSelectedRawRow(row)
    setRawRowModalOpen(true)
  }

  const handleViewBoundary = (row: RawRow) => {
    setSelectedBoundary(row)
    setBoundaryModalOpen(true)
  }

  const handleReview = async (id: string, status: 'confirmed' | 'rejected') => {
    await reviewCalculation(id, status, currentOperator)
  }

  const mixedFormatCalculations = useMemo(
    () => calculationDetails.filter((c) => c.mixed_format_flagged),
    [calculationDetails]
  )

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

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN')
  }

  const advanceButtonText = () => {
    if (currentStep === 0) return '确认原始行导入完成 →'
    if (currentStep === 1) return '确认边界值复核完成 →'
    if (currentStep === 2) return '确认计算明细更新完成 →'
    return '所有步骤已完成'
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold text-primary">
          数据复核
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          复核计算明细、混合格式数据和边界值说明，推进工作流程
        </p>
      </div>

      <div className="card">
        <StepIndicator steps={steps} />
        <div className="mt-6 flex justify-center">
          <button
            onClick={handleAdvanceWorkflow}
            disabled={currentStep >= 3}
            className="btn-secondary disabled:opacity-50"
          >
            {advanceButtonText()}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab('calculations')}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'calculations'
                ? 'border-b-2 border-accent text-accent'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            计算明细
          </button>
          <button
            onClick={() => setActiveTab('mixed')}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'mixed'
                ? 'border-b-2 border-accent text-accent'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            混合格式待复核
            {mixedFormatCalculations.length > 0 && (
              <span className="ml-1 rounded-full bg-danger px-2 py-0.5 text-xs text-white">
                {mixedFormatCalculations.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('boundary')}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'boundary'
                ? 'border-b-2 border-accent text-accent'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            边界值状态
          </button>
        </div>

        <div className="pt-6">
          {activeTab === 'calculations' && (
            <div className="space-y-6">
              <div className="flex justify-end">
                <button
                  onClick={refreshCalculations}
                  className="btn-primary"
                >
                  刷新计算明细
                </button>
              </div>

              {calculationDetails.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  暂无计算明细，请先导入数据
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-6">
                  {calculationDetails.map((calc: CalculationDetail) => (
                    <div
                      key={calc.id}
                      className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md"
                    >
                      <div className="mb-3 flex items-start justify-between">
                        <StatusBadge variant={calc.kept ? 'success' : 'danger'}>
                          {calc.kept ? '已保留' : '未保留'}
                        </StatusBadge>
                        <StatusBadge variant={getReviewStatusVariant(calc.review_status)}>
                          {getReviewStatusLabel(calc.review_status)}
                        </StatusBadge>
                      </div>

                      <p className="mb-4 line-clamp-2 text-sm text-slate-700">
                        {calc.raw_row?.content || '原始行内容加载中...'}
                      </p>

                      <div className="space-y-3">
                        <div>
                          <p className="text-xs font-semibold text-slate-500">
                            保留原因
                          </p>
                          <p className="mt-1 text-sm text-slate-700">
                            {calc.keep_reason || (
                              <span className="text-slate-400">待补充</span>
                            )}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs font-semibold text-slate-500">
                            缺失材料
                          </p>
                          {calc.missing_materials.length > 0 ? (
                            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-slate-700">
                              {calc.missing_materials.map((mat, idx) => (
                                <li key={idx}>{mat}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-1 text-sm text-slate-400">暂无缺失</p>
                          )}
                        </div>

                        <div>
                          <p className="text-xs font-semibold text-slate-500">
                            下一步行动
                          </p>
                          <p className="mt-1 flex items-center gap-1 text-sm text-slate-700">
                            <ChevronRight size={14} className="text-accent" />
                            {getNextActionLabel(calc.next_action)}
                          </p>
                        </div>
                      </div>

                      {calc.review_status === 'pending' && calc.mixed_format_flagged && (
                        <div className="mt-4 flex gap-2 border-t border-slate-100 pt-4">
                          <button
                            onClick={() => handleReview(calc.id, 'confirmed')}
                            className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-600"
                          >
                            <CheckCircle size={14} />
                            确认通过
                          </button>
                          <button
                            onClick={() => handleReview(calc.id, 'rejected')}
                            className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-rose-500 px-3 py-2 text-sm font-medium text-white hover:bg-rose-600"
                          >
                            <XCircle size={14} />
                            退回修正
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'mixed' && (
            <div className="space-y-4">
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3">
                <AlertTriangle size={18} className="mt-0.5 flex-shrink-0 text-amber-500" />
                <p className="text-xs text-amber-700">
                  <strong>注意：</strong>百分数和小数混着出现时，请勿自动归为正常，需活动负责人人工复核
                </p>
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="table-header">内容</th>
                      <th className="table-header">百分数值</th>
                      <th className="table-header">小数值</th>
                      <th className="table-header">状态</th>
                      <th className="table-header">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mixedFormatCalculations.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="table-cell text-center text-slate-400">
                          暂无混合格式待复核数据
                        </td>
                      </tr>
                    ) : (
                      mixedFormatCalculations.map((calc) => (
                        <tr key={calc.id} className="row-mixed hover:bg-slate-50">
                          <td className="table-cell max-w-md truncate">
                            {calc.raw_row?.content || '-'}
                          </td>
                          <td className="table-cell font-mono text-xs">
                            {calc.raw_row?.percentage_value || '-'}
                          </td>
                          <td className="table-cell font-mono text-xs">
                            {calc.raw_row?.decimal_value || '-'}
                          </td>
                          <td className="table-cell">
                            <StatusBadge variant={getReviewStatusVariant(calc.review_status)}>
                              {getReviewStatusLabel(calc.review_status)}
                            </StatusBadge>
                          </td>
                          <td className="table-cell">
                            <div className="flex gap-3">
                              <button
                                onClick={() => handleViewRawRow(calc.raw_row_id)}
                                className="text-xs text-blue-600 hover:text-blue-800"
                              >
                                <Eye size={14} className="inline" /> 查看原始行
                              </button>
                              <button
                                onClick={() => {
                                  const row = rawRows.find((r) => r.id === calc.raw_row_id)
                                  if (row) handleViewBoundary(row)
                                }}
                                className="text-xs text-primary hover:text-accent"
                              >
                                <Eye size={14} className="inline" /> 查看边界值
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
          )}

          {activeTab === 'boundary' && (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header">唯一键</th>
                    <th className="table-header">内容</th>
                    <th className="table-header">边界字段</th>
                    <th className="table-header">最小值</th>
                    <th className="table-header">最大值</th>
                    <th className="table-header">单位</th>
                    <th className="table-header">描述</th>
                    <th className="table-header">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {rawRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="table-cell text-center text-slate-400">
                        暂无数据
                      </td>
                    </tr>
                  ) : (
                    rawRows.map((row) => (
                      <tr
                        key={row.id}
                        className={`hover:bg-slate-50 ${
                          !row.boundary_spec ? 'row-missing-boundary' : ''
                        }`}
                      >
                        <td className="table-cell font-mono text-xs">{row.unique_key}</td>
                        <td className="table-cell max-w-xs truncate">{row.content}</td>
                        <td className="table-cell">
                          {row.boundary_spec?.field_name || '-'}
                        </td>
                        <td className="table-cell font-mono text-xs">
                          {row.boundary_spec?.min_value ?? '-'}
                        </td>
                        <td className="table-cell font-mono text-xs">
                          {row.boundary_spec?.max_value ?? '-'}
                        </td>
                        <td className="table-cell">{row.boundary_spec?.unit || '-'}</td>
                        <td className="table-cell max-w-xs truncate">
                          {row.boundary_spec?.description || '-'}
                        </td>
                        <td className="table-cell">
                          {row.boundary_spec ? (
                            <StatusBadge variant="success">已补充</StatusBadge>
                          ) : (
                            <StatusBadge variant="danger">待补充</StatusBadge>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {rawRowModalOpen && selectedRawRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 font-heading text-xl font-semibold text-primary">
              查看原始行
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium text-slate-500">唯一键</p>
                <p className="font-mono text-sm">{selectedRawRow.unique_key}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">内容</p>
                <p className="text-sm">{selectedRawRow.content}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-medium text-slate-500">百分数值</p>
                  <p className="font-mono text-sm">{selectedRawRow.percentage_value || '-'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">小数值</p>
                  <p className="font-mono text-sm">{selectedRawRow.decimal_value || '-'}</p>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">是否混合格式</p>
                <p className="text-sm">
                  {selectedRawRow.has_mixed_format ? (
                    <StatusBadge variant="warning">是</StatusBadge>
                  ) : (
                    <StatusBadge variant="success">否</StatusBadge>
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">创建时间</p>
                <p className="text-sm text-slate-600">{formatDate(selectedRawRow.created_at)}</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setRawRowModalOpen(false)}
                className="btn-outline"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {boundaryModalOpen && selectedBoundary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 font-heading text-xl font-semibold text-primary">
              查看边界值
            </h3>
            {selectedBoundary.boundary_spec ? (
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-slate-500">关联原始行</p>
                  <p className="text-sm">{selectedBoundary.unique_key} - {selectedBoundary.content}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">字段名称</p>
                  <p className="text-sm">{selectedBoundary.boundary_spec.field_name}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-medium text-slate-500">最小值</p>
                    <p className="font-mono text-sm">{selectedBoundary.boundary_spec.min_value ?? '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500">最大值</p>
                    <p className="font-mono text-sm">{selectedBoundary.boundary_spec.max_value ?? '-'}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">单位</p>
                  <p className="text-sm">{selectedBoundary.boundary_spec.unit}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">描述说明</p>
                  <p className="text-sm">{selectedBoundary.boundary_spec.description}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">创建时间</p>
                  <p className="text-sm text-slate-600">{formatDate(selectedBoundary.boundary_spec.created_at)}</p>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center">
                <AlertTriangle size={32} className="mx-auto mb-2 text-amber-500" />
                <p className="text-slate-500">该原始行尚未补充边界值</p>
              </div>
            )}
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setBoundaryModalOpen(false)}
                className="btn-outline"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
