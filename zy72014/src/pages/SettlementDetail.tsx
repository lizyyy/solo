import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSettlementStore } from '@/store/settlement'
import StatusBadge from '@/components/StatusBadge'
import ChangeTimeline from '@/components/ChangeTimeline'
import OverrideForm from '@/components/OverrideForm'
import RollbackForm from '@/components/RollbackForm'
import { ArrowLeft, AlertTriangle, Copy, FileWarning, Mail, FileText, MessageSquare, CreditCard } from 'lucide-react'
import type { SettlementDetail } from '@shared/types'

function formatMoney(v: number | null): string {
  if (v === null || v === undefined) return '—'
  return v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function SettlementDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentDetail, loading, fetchDetail, override, rollback } = useSettlementStore()

  useEffect(() => {
    if (id) fetchDetail(id)
  }, [id])

  if (loading || !currentDetail) {
    return (
      <div className="min-h-screen bg-[#f5f5f4] flex items-center justify-center">
        <p className="text-stone-400">加载中...</p>
      </div>
    )
  }

  const d: SettlementDetail = currentDetail

  return (
    <div className="min-h-screen bg-[#f5f5f4]">
      <header className="bg-[#1e3a5f] text-white px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1 text-sm hover:opacity-80 transition-opacity"
          >
            <ArrowLeft className="h-4 w-4" />
            返回列表
          </button>
          <h1 className="text-lg font-medium">
            {d.anchorName}（{d.anchorId}）结算详情
          </h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-6 space-y-6">
        {/* 状态与标记 */}
        <div className="bg-white border border-stone-200 p-4">
          <div className="flex items-center gap-3 mb-4">
            <StatusBadge status={d.status} />
            {d.hasEmptyFields && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700">
                <FileWarning className="h-3 w-3" />有空值字段
              </span>
            )}
            {d.isDuplicate && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700">
                <Copy className="h-3 w-3" />疑似重复
              </span>
            )}
            {d.isFullRefund && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700">
                <AlertTriangle className="h-3 w-3" />全额退款
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <div className="flex justify-between border-b border-stone-100 py-1.5">
              <span className="text-stone-500">打赏总额</span>
              <span className="font-mono">{d.totalTip !== null ? formatMoney(d.totalTip) : <em className="text-red-500">未填写</em>}</span>
            </div>
            <div className="flex justify-between border-b border-stone-100 py-1.5">
              <span className="text-stone-500">退款金额</span>
              <span className="font-mono">{d.refundAmount !== null ? formatMoney(d.refundAmount) : <em className="text-red-500">未填写</em>}</span>
            </div>
            <div className="flex justify-between border-b border-stone-100 py-1.5">
              <span className="text-stone-500">分成比例</span>
              <span className="font-mono">{d.shareRate !== null ? `${(d.shareRate * 100).toFixed(0)}%` : <em className="text-red-500">未填写</em>}</span>
            </div>
            <div className="flex justify-between border-b border-stone-100 py-1.5">
              <span className="text-stone-500">结算金额</span>
              <span className="font-mono font-medium">{d.settlementAmount !== null ? formatMoney(d.settlementAmount) : <em className="text-red-500">未填写</em>}</span>
            </div>
          </div>
        </div>

        {/* 依据链 */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-stone-700">结算依据链</h3>

          {/* 收款流水 */}
          <div className="bg-white border border-stone-200">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-stone-50 border-b border-stone-200">
              <CreditCard className="h-4 w-4 text-stone-500" />
              <span className="text-sm font-medium text-stone-700">收款流水</span>
            </div>
            {d.paymentFlow ? (
              <div className="px-4 py-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-stone-500">流水号</span>
                  <span className="font-mono">{d.paymentFlow.transactionId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">金额</span>
                  <span className="font-mono">{formatMoney(d.paymentFlow.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">时间</span>
                  <span>{d.paymentFlow.time}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">平台</span>
                  <span>{d.paymentFlow.platform}</span>
                </div>
              </div>
            ) : (
              <div className="px-4 py-3 text-sm text-red-500">无收款流水</div>
            )}
          </div>

          {/* 退款申请 */}
          <div className="bg-white border border-stone-200">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-stone-50 border-b border-stone-200">
              <FileText className="h-4 w-4 text-stone-500" />
              <span className="text-sm font-medium text-stone-700">退款申请</span>
            </div>
            {d.refundRequest ? (
              <div className="px-4 py-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-stone-500">申请单号</span>
                  <span className="font-mono">{d.refundRequest.requestId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">退款金额</span>
                  <span className="font-mono">{formatMoney(d.refundRequest.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">原因</span>
                  <span>{d.refundRequest.reason}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">时间</span>
                  <span>{d.refundRequest.time}</span>
                </div>
              </div>
            ) : (
              <div className="px-4 py-3 text-sm text-stone-400">无退款申请</div>
            )}
          </div>

          {/* 审批邮件 */}
          <div className="bg-white border border-stone-200">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-stone-50 border-b border-stone-200">
              <Mail className="h-4 w-4 text-stone-500" />
              <span className="text-sm font-medium text-stone-700">审批邮件</span>
              {d.approvalEmail && (
                <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700">含原始备注</span>
              )}
            </div>
            {d.approvalEmail ? (
              <div className="px-4 py-3 text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-stone-500">主题</span>
                  <span>{d.approvalEmail.subject}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">解析金额</span>
                  <span className="font-mono">{d.approvalEmail.parsedAmount !== null ? formatMoney(d.approvalEmail.parsedAmount) : '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">备注</span>
                  <span className="text-orange-700 font-medium">{d.approvalEmail.note}</span>
                </div>
                <div>
                  <span className="text-stone-500">邮件原文</span>
                  <pre className="mt-1 p-2 bg-stone-50 border border-stone-200 text-xs whitespace-pre-wrap font-mono text-stone-600 leading-relaxed">
{d.approvalEmail.rawContent}
                  </pre>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">收到时间</span>
                  <span>{d.approvalEmail.receivedAt}</span>
                </div>
              </div>
            ) : (
              <div className="px-4 py-3 text-sm text-stone-400">无审批邮件</div>
            )}
          </div>

          {/* 手写备注 */}
          <div className="bg-white border border-stone-200">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-stone-50 border-b border-stone-200">
              <MessageSquare className="h-4 w-4 text-stone-500" />
              <span className="text-sm font-medium text-stone-700">手写备注</span>
            </div>
            {d.handwrittenNote ? (
              <div className="px-4 py-3 text-sm text-stone-700">
                {d.handwrittenNote}
              </div>
            ) : (
              <div className="px-4 py-3 text-sm text-stone-400">无手写备注</div>
            )}
          </div>
        </div>

        {/* 变更历史 */}
        <div className="bg-white border border-stone-200 p-4">
          <h3 className="text-sm font-medium text-stone-700 mb-3">变更历史</h3>
          <ChangeTimeline records={d.changeHistory} />
        </div>

        {/* 操作区 */}
        <div className="space-y-4">
          <OverrideForm
            loading={loading}
            onSubmit={(field, newValue, reason) => {
              if (id) override(id, field, newValue, reason)
            }}
          />
          <RollbackForm
            loading={loading}
            onSubmit={(reason) => {
              if (id) rollback(id, reason)
            }}
          />
        </div>
      </main>
    </div>
  )
}
