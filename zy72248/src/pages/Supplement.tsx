import { useState, useMemo } from 'react'
import {
  PenLine,
  FileInput,
  Hash,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  ChevronRight,
  ChevronLeft,
  XCircle,
} from 'lucide-react'
import { useBillStore } from '@/store/billStore'
import { STATUS_LABELS } from '@/types'
import type { BillItem } from '@/types'
import { cn } from '@/lib/utils'

type Step = 1 | 2 | 3

const STEPS = [
  { step: 1 as Step, label: '税费率备注导入', icon: FileInput },
  { step: 2 as Step, label: '补看柜台流水尾号', icon: Hash },
  { step: 3 as Step, label: '摘要更新', icon: FileText },
]

export default function Supplement() {
  const items = useBillStore((s) => s.items)
  const advanceSupplement = useBillStore((s) => s.advanceSupplement)
  const reviewRisk = useBillStore((s) => s.reviewRisk)

  const [currentStep, setCurrentStep] = useState<Step>(1)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [workingBillId, setWorkingBillId] = useState<string | null>(null)

  const supplementItems = useMemo(
    () => items.filter((it) => it.status === 'supplement'),
    [items]
  )

  const riskReviewItems = useMemo(
    () => items.filter((it) => it.status === 'risk_review'),
    [items]
  )

  const workingItem = useMemo(
    () => items.find((it) => it.id === workingBillId) ?? null,
    [items, workingBillId]
  )

  const stepFilteredItems = useMemo(() => {
    if (!workingItem) return supplementItems
    return supplementItems.filter((it) => it.supplementStep < currentStep || it.id === workingItem.id)
  }, [supplementItems, workingItem, currentStep])

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = (ids: string[]) => {
    setSelectedIds((prev) => {
      const allSelected = ids.every((id) => prev.has(id))
      const next = new Set(prev)
      if (allSelected) {
        ids.forEach((id) => next.delete(id))
      } else {
        ids.forEach((id) => next.add(id))
      }
      return next
    })
  }

  const handleStartWork = (item: BillItem) => {
    setWorkingBillId(item.id)
    setSelectedIds(new Set([item.id]))
    setCurrentStep((item.supplementStep + 1) as Step)
  }

  const handleNext = () => {
    if (!workingItem) return
    advanceSupplement(workingItem.id, currentStep, '阿芬')
    if (currentStep < 3) {
      setCurrentStep((currentStep + 1) as Step)
    }
  }

  const handlePrev = () => {
    if (currentStep > 1) setCurrentStep((currentStep - 1) as Step)
  }

  const handleRiskReview = (billId: string, status: 'approved' | 'rejected') => {
    reviewRisk(billId, status, '风控员')
  }

  const eligibleIds = stepFilteredItems.map((it) => it.id)
  const allSelected = eligibleIds.length > 0 && eligibleIds.every((id) => selectedIds.has(id))

  return (
    <div className="h-full flex flex-col">
      <header className="px-8 py-5 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-navy-500 flex items-center justify-center">
            <PenLine size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-navy-500">补录工作台</h1>
            <p className="text-xs text-gray-500 mt-0.5">票据影像补录三步流程</p>
          </div>
          <div className="ml-auto flex items-center gap-3 text-sm text-gray-500">
            <span>待补录 <strong className="text-navy-500">{supplementItems.length}</strong></span>
            <span className="text-gray-300">|</span>
            <span>风控待复核 <strong className="text-crimson-500">{riskReviewItems.length}</strong></span>
          </div>
        </div>
      </header>

      {riskReviewItems.length > 0 && (
        <div className="px-8 pt-4">
          <div className="rounded-lg border border-crimson-500/30 bg-crimson-50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <ShieldAlert size={18} className="text-crimson-500" />
              <h3 className="text-sm font-bold text-crimson-500">风控待复核项目</h3>
              <span className="ml-1 text-xs bg-crimson-500 text-white rounded-full px-2 py-0.5 font-bold">
                {riskReviewItems.length}
              </span>
            </div>
            <div className="space-y-2">
              {riskReviewItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-4 bg-white rounded-md border border-crimson-500/20 px-4 py-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-navy-500">
                        {item.billNo}
                      </span>
                      <span className="text-xs bg-crimson-100 text-crimson-500 px-1.5 py-0.5 rounded font-medium">
                        {STATUS_LABELS[item.status]}
                      </span>
                    </div>
                    <p className="text-xs text-crimson-500 mt-1">
                      金额为0且备注已冲正，需风控复核后才能继续
                    </p>
                    <div className="text-xs text-gray-400 mt-1 font-mono">
                      金额: {item.amount.toFixed(2)} | 备注: {item.remark} | 税费率: {item.taxRateRemark}
                    </div>
                  </div>
                  {item.riskReviewStatus === 'pending' ? (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleRiskReview(item.id, 'approved')}
                        className="px-3 py-1.5 text-xs font-semibold rounded-md bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
                      >
                        通过
                      </button>
                      <button
                        onClick={() => handleRiskReview(item.id, 'rejected')}
                        className="px-3 py-1.5 text-xs font-semibold rounded-md bg-crimson-500 text-white hover:bg-crimson-500/80 transition-colors"
                      >
                        驳回
                      </button>
                    </div>
                  ) : item.riskReviewStatus === 'approved' ? (
                    <span className="text-xs text-emerald-500 font-semibold flex items-center gap-1 flex-shrink-0">
                      <CheckCircle2 size={14} /> 已通过
                    </span>
                  ) : (
                    <span className="text-xs text-crimson-500 font-semibold flex items-center gap-1 flex-shrink-0">
                      <XCircle size={14} /> 已驳回
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {workingItem ? (
        <div className="flex-1 flex flex-col overflow-hidden px-8 pt-4">
          <div className="bg-white rounded-lg border border-gray-200 px-6 py-4 mb-4">
            <div className="flex items-center justify-between mb-4">
              {STEPS.map(({ step, label, icon: Icon }, idx) => {
                const isActive = step === currentStep
                const isCompleted = workingItem.supplementStep >= step
                return (
                  <div key={step} className="flex items-center flex-1 last:flex-none">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors',
                          isCompleted
                            ? 'bg-emerald-500 text-white'
                            : isActive
                            ? 'bg-navy-500 text-white'
                            : 'bg-gray-100 text-gray-400'
                        )}
                      >
                        {isCompleted ? <CheckCircle2 size={16} /> : step}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Icon
                          size={14}
                          className={cn(
                            isCompleted
                              ? 'text-emerald-500'
                              : isActive
                              ? 'text-navy-500'
                              : 'text-gray-300'
                          )}
                        />
                        <span
                          className={cn(
                            'text-sm font-medium',
                            isCompleted
                              ? 'text-emerald-500'
                              : isActive
                              ? 'text-navy-500'
                              : 'text-gray-400'
                          )}
                        >
                          {label}
                        </span>
                      </div>
                    </div>
                    {idx < STEPS.length - 1 && (
                      <div
                        className={cn(
                          'flex-1 h-px mx-4',
                          workingItem.supplementStep > step ? 'bg-emerald-500' : 'bg-gray-200'
                        )}
                      />
                    )}
                  </div>
                )
              })}
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span>
                当前票据: <strong className="font-mono text-navy-500">{workingItem.billNo}</strong>
              </span>
              <span className="text-gray-300">|</span>
              <span>
                金额: <strong className="font-mono text-navy-500">{workingItem.amount.toFixed(2)}</strong>
              </span>
              <span className="text-gray-300">|</span>
              <span>
                步骤: <strong className="text-navy-500">{workingItem.supplementStep}/3</strong>
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-auto bg-white rounded-lg border border-gray-200">
            {currentStep === 1 && (
              <StepOneContent
                items={stepFilteredItems}
                selectedIds={selectedIds}
                allSelected={allSelected}
                onToggle={toggleSelect}
                onToggleAll={() => toggleAll(eligibleIds)}
              />
            )}
            {currentStep === 2 && (
              <StepTwoContent
                items={stepFilteredItems.filter((it) => selectedIds.has(it.id))}
              />
            )}
            {currentStep === 3 && (
              <StepThreeContent item={workingItem} />
            )}
          </div>

          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setWorkingBillId(null)
                  setSelectedIds(new Set())
                  setCurrentStep(1)
                }}
                className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                返回列表
              </button>
            </div>
            <div className="flex items-center gap-3">
              {currentStep > 1 && (
                <button
                  onClick={handlePrev}
                  className="flex items-center gap-1 px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <ChevronLeft size={16} /> 上一步
                </button>
              )}
              <button
                onClick={handleNext}
                disabled={currentStep === 1 && selectedIds.size === 0}
                className={cn(
                  'flex items-center gap-1 px-5 py-2 text-sm rounded-md font-semibold transition-colors',
                  currentStep === 1 && selectedIds.size === 0
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-navy-500 text-white hover:bg-navy-600'
                )}
              >
                {currentStep === 3 ? '确认更新摘要' : '下一步'}
                {currentStep < 3 && <ChevronRight size={16} />}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto px-8 pt-4">
          {supplementItems.length === 0 && riskReviewItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <PenLine size={48} className="mb-3 text-gray-200" />
              <p className="text-sm">暂无待补录项目</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      票据号
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      金额
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      税费率备注
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      柜台流水尾号
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      备注
                    </th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      补录进度
                    </th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {supplementItems.map((item) => {
                    const isZeroReversal = item.isZeroWithReversal
                    return (
                      <tr
                        key={item.id}
                        className={cn(
                          'hover:bg-gray-50 transition-colors',
                          isZeroReversal && 'bg-crimson-50'
                        )}
                      >
                        <td className="px-4 py-3 font-mono font-semibold text-navy-500">
                          {item.billNo}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          {item.amount.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 font-mono">{item.taxRateRemark}</td>
                        <td className="px-4 py-3 font-mono">{item.counterTxnTailNo}</td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'text-xs px-1.5 py-0.5 rounded',
                              isZeroReversal
                                ? 'bg-crimson-100 text-crimson-500 font-medium'
                                : 'bg-gray-100 text-gray-600'
                            )}
                          >
                            {item.remark || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <StepProgress step={item.supplementStep} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          {isZeroReversal ? (
                            <span className="text-xs text-crimson-500 font-medium flex items-center justify-center gap-1">
                              <ShieldAlert size={12} /> 需风控复核
                            </span>
                          ) : (
                            <button
                              onClick={() => handleStartWork(item)}
                              className="text-xs font-semibold text-navy-500 hover:text-navy-600 transition-colors flex items-center justify-center gap-1 mx-auto"
                            >
                              <PenLine size={12} /> 开始补录
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StepProgress({ step }: { step: number }) {
  return (
    <div className="flex items-center justify-center gap-1">
      {[1, 2, 3].map((s) => (
        <div
          key={s}
          className={cn(
            'w-2 h-2 rounded-full',
            step >= s ? 'bg-emerald-500' : 'bg-gray-200'
          )}
        />
      ))}
      <span className="ml-1 text-xs text-gray-400 font-mono">{step}/3</span>
    </div>
  )
}

function StepOneContent({
  items,
  selectedIds,
  allSelected,
  onToggle,
  onToggleAll,
}: {
  items: BillItem[]
  selectedIds: Set<string>
  allSelected: boolean
  onToggle: (id: string) => void
  onToggleAll: () => void
}) {
  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <FileInput size={16} className="text-navy-500" />
        <h3 className="text-sm font-bold text-navy-500">税费率备注导入</h3>
        <span className="text-xs text-gray-400 ml-2">
          选择需要导入税费率备注的票据项
        </span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="px-4 py-2.5 text-left">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onToggleAll}
                className="rounded border-gray-300 text-navy-500 focus:ring-navy-500"
              />
            </th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">
              票据号
            </th>
            <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">
              金额
            </th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">
              当前税费率备注
            </th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">
              备注
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map((item) => (
            <tr
              key={item.id}
              className={cn(
                'hover:bg-gray-50 transition-colors',
                selectedIds.has(item.id) && 'bg-navy-50'
              )}
            >
              <td className="px-4 py-2.5">
                <input
                  type="checkbox"
                  checked={selectedIds.has(item.id)}
                  onChange={() => onToggle(item.id)}
                  className="rounded border-gray-300 text-navy-500 focus:ring-navy-500"
                />
              </td>
              <td className="px-4 py-2.5 font-mono font-semibold text-navy-500">
                {item.billNo}
              </td>
              <td className="px-4 py-2.5 text-right font-mono">
                {item.amount.toFixed(2)}
              </td>
              <td className="px-4 py-2.5 font-mono">{item.taxRateRemark}</td>
              <td className="px-4 py-2.5 text-xs text-gray-500">{item.remark || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {items.length === 0 && (
        <div className="py-12 text-center text-sm text-gray-400">没有需要导入的项</div>
      )}
    </div>
  )
}

function StepTwoContent({ items }: { items: BillItem[] }) {
  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <Hash size={16} className="text-navy-500" />
        <h3 className="text-sm font-bold text-navy-500">补看柜台流水尾号</h3>
        <span className="text-xs text-gray-400 ml-2">
          核对柜台流水尾号与税费率备注是否一致
        </span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">
              票据号
            </th>
            <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">
              金额
            </th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">
              税费率备注
            </th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">
              柜台流水尾号
            </th>
            <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">
              核对结果
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map((item) => {
            const taxNum = parseFloat(item.taxRateRemark)
            const isMatch = !isNaN(taxNum) && taxNum > 0
              ? item.counterTxnTailNo.length > 0
              : true
            return (
              <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-2.5 font-mono font-semibold text-navy-500">
                  {item.billNo}
                </td>
                <td className="px-4 py-2.5 text-right font-mono">
                  {item.amount.toFixed(2)}
                </td>
                <td className="px-4 py-2.5 font-mono">{item.taxRateRemark}</td>
                <td className="px-4 py-2.5 font-mono">{item.counterTxnTailNo}</td>
                <td className="px-4 py-2.5 text-center">
                  {isMatch ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-500 bg-emerald-50 px-2 py-1 rounded-full">
                      <CheckCircle2 size={14} /> 一致
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-500 bg-amber-50 px-2 py-1 rounded-full">
                      <AlertTriangle size={14} /> 不一致
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {items.length === 0 && (
        <div className="py-12 text-center text-sm text-gray-400">没有选中的项</div>
      )}
    </div>
  )
}

function StepThreeContent({ item }: { item: BillItem }) {
  const oldSummary = item.amount * (parseFloat(item.taxRateRemark) || 0) / 100
  const newSummary = item.amount * (parseFloat(item.taxRateRemark) || 0) / 100

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <FileText size={16} className="text-navy-500" />
        <h3 className="text-sm font-bold text-navy-500">摘要更新</h3>
        <span className="text-xs text-gray-400 ml-2">
          确认补录结果，更新摘要信息
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="rounded-lg border border-gray-200 p-4">
          <h4 className="text-xs font-semibold text-gray-400 uppercase mb-3">补录前</h4>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">票据号</span>
              <span className="font-mono font-semibold text-navy-500">{item.billNo}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">金额</span>
              <span className="font-mono text-gray-700">{item.amount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">税费率备注</span>
              <span className="font-mono text-gray-700">{item.taxRateRemark}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">柜台流水尾号</span>
              <span className="font-mono text-gray-700">{item.counterTxnTailNo}</span>
            </div>
            <div className="flex justify-between text-sm border-t border-gray-100 pt-2">
              <span className="text-gray-500">税额估算</span>
              <span className="font-mono text-gray-400 line-through">
                {oldSummary.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <h4 className="text-xs font-semibold text-emerald-500 uppercase mb-3">补录后</h4>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-emerald-600">票据号</span>
              <span className="font-mono font-semibold text-navy-500">{item.billNo}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-emerald-600">金额</span>
              <span className="font-mono text-emerald-700">{item.amount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-emerald-600">税费率备注</span>
              <span className="font-mono text-emerald-700">{item.taxRateRemark}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-emerald-600">柜台流水尾号</span>
              <span className="font-mono text-emerald-700">{item.counterTxnTailNo}</span>
            </div>
            <div className="flex justify-between text-sm border-t border-emerald-200 pt-2">
              <span className="text-emerald-600">税额重算</span>
              <span className="font-mono font-semibold text-emerald-500">
                {newSummary.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle size={16} className="text-amber-500" />
          <span className="text-sm font-semibold text-amber-500">确认提示</span>
        </div>
        <p className="text-sm text-amber-600">
          点击「确认更新摘要」将更新责任人摘要信息，补录后税额将由{' '}
          <span className="font-mono line-through">{oldSummary.toFixed(2)}</span> 变更为{' '}
          <span className="font-mono font-semibold">{newSummary.toFixed(2)}</span>，此操作不可撤销。
        </p>
      </div>
    </div>
  )
}
