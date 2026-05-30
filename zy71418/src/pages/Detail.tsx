import { useParams, useNavigate } from 'react-router-dom'
import { getRecordById, getTimelineEvents, getRateEvidence, getFeeRecalcDetails, getCancelRollbackDetails } from '@/mockData'
import { MARKET_LABELS, STATUS_LABELS, DIFF_TYPE_LABELS } from '@/types'
import type { Market, ReconciliationStatus, DiffType } from '@/types'
import TimelineView from '@/components/TimelineView'
import RateEvidenceCard from '@/components/RateEvidence'
import AggregationConclusionView from '@/components/AggregationConclusionView'
import { FeeRecalcPanel, CancelRollbackPanel } from '@/components/DetailPanels'
import { ArrowLeft, Scale } from 'lucide-react'

function formatAmount(v: number) {
  return v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function Detail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const record = id ? getRecordById(id) : undefined
  if (!record) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center">
          <p className="text-slate-400 text-sm mb-3">未找到该对账记录</p>
          <button
            onClick={() => navigate('/')}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            返回工作台
          </button>
        </div>
      </div>
    )
  }

  const timeline = getTimelineEvents(record.id)
  const rateEvidence = getRateEvidence(record.id)
  const feeRecalc = getFeeRecalcDetails(record.id)
  const cancelRollback = getCancelRollbackDetails(record.id)

  return (
    <div className="h-screen flex flex-col bg-slate-950">
      <header className="flex items-center gap-3 px-5 py-3 bg-slate-900 border-b border-slate-700/50 flex-shrink-0">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft size={14} />
          返回
        </button>
        <div className="w-px h-4 bg-slate-700" />
        <div className="flex items-center gap-2">
          <Scale size={16} className="text-blue-400" />
          <h1 className="text-sm font-semibold text-slate-100">对账详情</h1>
        </div>
        <span className="font-mono-amount text-xs text-slate-400">{record.orderId}</span>
      </header>

      <div className="flex-1 overflow-y-auto p-5">
        <div className="max-w-4xl mx-auto space-y-5">
          <div className="rounded-lg border border-slate-700/50 bg-slate-900/60 p-4">
            <div className="grid grid-cols-4 gap-4 mb-3">
              <div>
                <div className="text-[10px] text-slate-500 mb-0.5">经纪商</div>
                <div className="text-xs text-slate-200 font-medium">{record.brokerName}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 mb-0.5">市场</div>
                <div className="text-xs text-slate-200">{MARKET_LABELS[record.market as Market]}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 mb-0.5">状态</div>
                <div>
                  <span className={`status-badge status-${record.status as ReconciliationStatus}`}>
                    {STATUS_LABELS[record.status as ReconciliationStatus]}
                  </span>
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 mb-0.5">差异类型</div>
                <div className="flex flex-wrap gap-1">
                  {record.diffTypes.length === 0 ? (
                    <span className="text-xs text-slate-500">无差异</span>
                  ) : (
                    record.diffTypes.map(dt => (
                      <span key={dt} className={`diff-tag diff-tag-${dt}`}>
                        {DIFF_TYPE_LABELS[dt as DiffType]}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-3 border-t border-slate-700/40">
              <div>
                <div className="text-[10px] text-slate-500 mb-0.5">撮合费</div>
                <div className="text-sm font-mono-amount font-semibold text-slate-200">¥{formatAmount(record.matchingFee)}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 mb-0.5">成交回报费</div>
                <div className="text-sm font-mono-amount font-semibold text-slate-200">¥{formatAmount(record.tradeReportFee)}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 mb-0.5">差异金额</div>
                <div className={`text-sm font-mono-amount font-semibold ${
                  record.diffAmount > 0 ? 'text-amber-400' : record.diffAmount < 0 ? 'text-rose-400' : 'text-emerald-400'
                }`}>
                  {record.diffAmount > 0 ? '+' : ''}¥{formatAmount(record.diffAmount)}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-700/50 bg-slate-900/60 p-4">
            <h2 className="text-xs font-semibold text-slate-200 mb-4">事件时间线</h2>
            <TimelineView events={timeline} />
          </div>

          {rateEvidence && rateEvidence.isInconsistent && (
            <RateEvidenceCard evidence={rateEvidence} />
          )}

          {record.aggregationConclusion && (
            <AggregationConclusionView
              conclusion={record.aggregationConclusion}
              diffAmount={record.diffAmount}
            />
          )}

          <FeeRecalcPanel details={feeRecalc} />
          <CancelRollbackPanel details={cancelRollback} />
        </div>
      </div>
    </div>
  )
}
