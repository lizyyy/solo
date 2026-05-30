import { useState, useMemo } from 'react'
import { Clock, Copy, CalendarX, ChevronRight, Play } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { exportToCSV, downloadCSV, downloadPDFReport } from '@/engine/export'
import type { ExceptionRecord } from '@/data/types'
import Drawer from '@/components/shared/Drawer'
import DetailTable from '@/components/shared/DetailTable'
import StatusBadge from '@/components/shared/StatusBadge'

const TYPE_ICON_MAP: Record<ExceptionRecord['type'], React.ReactNode> = {
  withdrawal_delay: <Clock size={16} className="text-[#f59e0b]" />,
  forward_duplicate: <Copy size={16} className="text-[#38bdf8]" />,
  rate_date_error: <CalendarX size={16} className="text-[#ef4444]" />,
}

const TYPE_LABEL_MAP: Record<ExceptionRecord['type'], string> = {
  withdrawal_delay: '提现延迟',
  forward_duplicate: '锁汇重复',
  rate_date_error: '汇率日期错误',
}

const STATUS_BADGE_MAP: Record<ExceptionRecord['status'], { label: string; variant: 'red' | 'amber' | 'green' }> = {
  unresolved: { label: '未解决', variant: 'red' },
  skipped: { label: '已跳过', variant: 'amber' },
  resolved: { label: '已解决', variant: 'green' },
}

export default function AlertsPage() {
  const {
    exceptions,
    settlementPlans,
    transactions,
    withdrawals,
    forwardContracts,
    isExecuted,
    markExceptionResolved,
    executeBatchPlans,
  } = useStore()

  const [drawerId, setDrawerId] = useState<string | null>(null)
  const [dateFrom, setDateFrom] = useState('2026-05-01')
  const [dateTo, setDateTo] = useState('2026-06-30')

  const selectedException = useMemo(
    () => exceptions.find((e) => e.id === drawerId) ?? null,
    [drawerId, exceptions]
  )

  const planCounts = useMemo(() => {
    const executed = settlementPlans.filter((p) => p.status === 'executed').length
    const skipped = settlementPlans.filter((p) => p.status === 'skipped_exception').length
    const planned = settlementPlans.filter((p) => p.status === 'planned').length
    const total = settlementPlans.length
    return { executed, skipped, planned, total }
  }, [settlementPlans])

  const reportSummary = useMemo(() => {
    const executed = settlementPlans.filter((p) => p.status === 'executed')
    const skipped = settlementPlans.filter((p) => p.status === 'skipped_exception')
    const planned = settlementPlans.filter((p) => p.status === 'planned')
    const totalSettledCNY = executed.reduce((s, p) => s + p.settledAmountCNY, 0)
    const totalUncoveredCNY = planned.reduce((s, p) => s + p.settledAmountCNY, 0)
    return {
      totalSettledCNY,
      totalUncoveredCNY,
      exceptionCount: exceptions.length,
      executedCount: executed.length,
      skippedCount: skipped.length,
      plannedCount: planned.length,
    }
  }, [settlementPlans, exceptions])

  const drawerDetailRows = useMemo(() => {
    if (!selectedException) return []
    const e = selectedException
    return [
      { label: '异常ID', value: e.id },
      { label: '类型', value: TYPE_LABEL_MAP[e.type] },
      { label: '描述', value: e.description },
      { label: '影响金额', value: `${e.impactAmount.toLocaleString()} ${e.impactCurrency}` },
      { label: '原因', value: e.reason },
      { label: '状态', value: STATUS_BADGE_MAP[e.status].label },
      ...(e.relatedTransactionId ? [{ label: '关联交易ID', value: e.relatedTransactionId }] : []),
      ...(e.relatedForwardId ? [{ label: '关联锁汇ID', value: e.relatedForwardId }] : []),
      ...(e.relatedWithdrawalId ? [{ label: '关联提现ID', value: e.relatedWithdrawalId }] : []),
    ]
  }, [selectedException])

  const planColumns = useMemo(
    () => [
      { key: 'id', title: '计划ID' },
      { key: 'transactionId', title: '交易ID' },
      { key: 'currency', title: '币种' },
      {
        key: 'amount',
        title: '金额',
        render: (v: unknown) => (v as number).toLocaleString(),
      },
      {
        key: 'settledRate',
        title: '结汇汇率',
        render: (v: unknown) => (v as number).toFixed(4),
      },
      {
        key: 'settledAmountCNY',
        title: '人民币金额',
        render: (v: unknown) => `¥${(v as number).toLocaleString('zh-CN')}`,
      },
      { key: 'plannedDate', title: '计划日期' },
      {
        key: 'status',
        title: '状态',
        render: (v: unknown) => {
          const s = v as string
          if (s === 'executed') return <StatusBadge label="已执行" variant="green" />
          if (s === 'skipped_exception') return <StatusBadge label="异常跳过" variant="amber" />
          return <StatusBadge label="待执行" variant="gray" />
        },
      },
    ],
    []
  )

  const pct = (count: number) => (planCounts.total > 0 ? (count / planCounts.total) * 100 : 0)

  return (
    <div className="min-h-screen bg-[#0f1219] p-6 space-y-6">
      <div className="rounded-lg bg-[#1a1f2e] p-5 border border-[#2a3040]">
        <h2 className="text-base font-semibold text-white mb-4">异常记录</h2>
        {exceptions.length === 0 ? (
          <div className="py-8 text-center text-gray-500 text-sm">暂无异常记录</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a3040]">
                  <th className="text-left py-2 px-3 text-gray-400 font-medium w-10" />
                  <th className="text-left py-2 px-3 text-gray-400 font-medium">类型</th>
                  <th className="text-left py-2 px-3 text-gray-400 font-medium">描述</th>
                  <th className="text-left py-2 px-3 text-gray-400 font-medium">影响金额</th>
                  <th className="text-left py-2 px-3 text-gray-400 font-medium">原因</th>
                  <th className="text-left py-2 px-3 text-gray-400 font-medium">状态</th>
                  <th className="text-left py-2 px-3 text-gray-400 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {exceptions.map((e) => (
                  <tr
                    key={e.id}
                    className="border-b border-[#2a3040]/50 hover:bg-[#2a3040]/30 transition-colors cursor-pointer"
                    onClick={() => setDrawerId(e.id)}
                  >
                    <td className="py-2.5 px-3">{TYPE_ICON_MAP[e.type]}</td>
                    <td className="py-2.5 px-3 text-gray-200">{TYPE_LABEL_MAP[e.type]}</td>
                    <td className="py-2.5 px-3 text-gray-300 max-w-[240px] truncate">{e.description}</td>
                    <td className="py-2.5 px-3 text-gray-200">
                      {e.impactAmount.toLocaleString()} <span className="text-gray-500">{e.impactCurrency}</span>
                    </td>
                    <td className="py-2.5 px-3 text-gray-400 max-w-[200px] truncate">{e.reason}</td>
                    <td className="py-2.5 px-3">
                      <StatusBadge
                        label={STATUS_BADGE_MAP[e.status].label}
                        variant={STATUS_BADGE_MAP[e.status].variant}
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        {e.status === 'unresolved' && (
                          <button
                            className="px-2 py-1 rounded text-xs font-medium bg-[#00d4aa]/15 text-[#00d4aa] border border-[#00d4aa]/30 hover:bg-[#00d4aa]/25 transition-colors"
                            onClick={(ev) => {
                              ev.stopPropagation()
                              markExceptionResolved(e.id)
                            }}
                          >
                            标记已解决
                          </button>
                        )}
                        <ChevronRight size={14} className="text-gray-500" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-lg bg-[#1a1f2e] p-5 border border-[#2a3040]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-white">批量执行进度</h2>
          {!isExecuted && (
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-[#00d4aa]/15 text-[#00d4aa] border border-[#00d4aa]/30 hover:bg-[#00d4aa]/25 transition-colors"
              onClick={executeBatchPlans}
            >
              <Play size={12} />
              批量执行
            </button>
          )}
        </div>
        <div className="flex h-6 rounded-full overflow-hidden bg-white/5 mb-3">
          {planCounts.executed > 0 && (
            <div
              className="bg-emerald-500 transition-all duration-500"
              style={{ width: `${pct(planCounts.executed)}%` }}
            />
          )}
          {planCounts.skipped > 0 && (
            <div
              className="bg-amber-500 transition-all duration-500"
              style={{ width: `${pct(planCounts.skipped)}%` }}
            />
          )}
          {planCounts.planned > 0 && (
            <div
              className="bg-white/10 transition-all duration-500"
              style={{ width: `${pct(planCounts.planned)}%` }}
            />
          )}
        </div>
        <div className="flex items-center gap-6 mb-5 text-xs text-gray-400">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            已执行 {planCounts.executed}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            异常跳过 {planCounts.skipped}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
            待执行 {planCounts.planned}
          </div>
        </div>
        <DetailTable
          columns={planColumns}
          data={settlementPlans as unknown as Record<string, unknown>[]}
        />
      </div>

      <div className="rounded-lg bg-[#1a1f2e] p-5 border border-[#2a3040]">
        <h2 className="text-base font-semibold text-white mb-4">报告生成</h2>
        <div className="flex items-center gap-4 mb-5">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400">起始日期</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-[#0f1219] border border-[#2a3040] rounded px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-[#00d4aa]/50"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400">截止日期</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-[#0f1219] border border-[#2a3040] rounded px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-[#00d4aa]/50"
            />
          </div>
        </div>

        <div className="rounded-lg bg-[#0f1219] border border-[#2a3040] p-4 mb-5">
          <h3 className="text-xs font-semibold text-gray-400 mb-3">报告预览</h3>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-gray-500 mb-1">已结汇总额(CNY)</div>
              <div className="text-lg font-bold text-[#00d4aa]">
                ¥{reportSummary.totalSettledCNY.toLocaleString('zh-CN')}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">未覆盖金额(CNY)</div>
              <div className="text-lg font-bold text-[#f59e0b]">
                ¥{reportSummary.totalUncoveredCNY.toLocaleString('zh-CN')}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">异常笔数</div>
              <div className="text-lg font-bold text-[#ef4444]">{reportSummary.exceptionCount}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">排程状态</div>
              <div className="space-y-0.5 text-xs text-gray-300">
                <div>已执行 {reportSummary.executedCount}</div>
                <div>异常跳过 {reportSummary.skippedCount}</div>
                <div>待执行 {reportSummary.plannedCount}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            className="px-4 py-2 rounded text-sm font-medium bg-[#00d4aa]/15 text-[#00d4aa] border border-[#00d4aa]/30 hover:bg-[#00d4aa]/25 transition-colors"
            onClick={() => {
              const content = exportToCSV(settlementPlans, exceptions, transactions, withdrawals, forwardContracts)
              const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
              downloadCSV(content, `结汇排程报告_${today}.csv`)
            }}
          >
            导出 CSV
          </button>
          <button
            className="px-4 py-2 rounded text-sm font-medium bg-[#38bdf8]/15 text-[#38bdf8] border border-[#38bdf8]/30 hover:bg-[#38bdf8]/25 transition-colors"
            onClick={() => {
              downloadPDFReport(settlementPlans, exceptions, dateFrom, dateTo)
            }}
          >
            导出 PDF
          </button>
        </div>
      </div>

      <Drawer
        open={drawerId !== null}
        title="异常详情"
        onClose={() => setDrawerId(null)}
      >
        {selectedException && <DetailTable rows={drawerDetailRows} />}
      </Drawer>
    </div>
  )
}
