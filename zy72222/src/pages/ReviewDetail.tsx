import { useParams, useNavigate } from "react-router-dom"
import { useReviewStore } from "@/store/useReviewStore"
import { useState } from "react"
import StatusBadge from "@/components/StatusBadge"
import AuditTimeline from "@/components/AuditTimeline"
import BalanceTable from "@/components/BalanceTable"
import {
  ArrowLeft,
  PenLine,
  ShieldCheck,
  ShieldX,
  AlertTriangle,
  CheckCircle,
} from "lucide-react"

export default function ReviewDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const record = useReviewStore((s) => s.getRecord(id!))
  const supplementTailNumber = useReviewStore((s) => s.supplementTailNumber)
  const applyCorrection = useReviewStore((s) => s.applyCorrection)
  const rerunBalance = useReviewStore((s) => s.rerunBalance)
  const reviewApprove = useReviewStore((s) => s.reviewApprove)
  const reviewReject = useReviewStore((s) => s.reviewReject)

  const [tailInput, setTailInput] = useState("")
  const [correctionAmount, setCorrectionAmount] = useState("")
  const [correctionReason, setCorrectionReason] = useState("")
  const [showCorrection, setShowCorrection] = useState(false)

  if (!record) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-zinc-400">记录不存在</p>
          <button
            onClick={() => navigate("/")}
            className="mt-4 px-4 py-2 rounded-lg text-sm text-teal-600 hover:bg-teal-50 transition-colors"
          >
            返回看板
          </button>
        </div>
      </div>
    )
  }

  const handleSupplement = () => {
    if (!tailInput.trim()) return
    supplementTailNumber(record.id, tailInput.trim())
    setTailInput("")
  }

  const handleCorrection = () => {
    if (!correctionAmount || !correctionReason) return
    applyCorrection(
      record.id,
      parseFloat(correctionAmount),
      correctionReason
    )
    setCorrectionAmount("")
    setCorrectionReason("")
    setShowCorrection(false)
  }

  const handleRerun = () => {
    rerunBalance(record.id)
  }

  const handleApprove = () => {
    reviewApprove(record.id)
  }

  const handleReject = () => {
    reviewReject(record.id)
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-200">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-4">
          <button
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            返回看板
          </button>
          <div className="h-4 w-px bg-zinc-200" />
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold text-zinc-900">
              复盘详情 #{record.id}
            </h1>
            <StatusBadge status={record.status} />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6 space-y-5">
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4">
            基本信息
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-[11px] text-zinc-400 mb-0.5">日期</p>
              <p className="text-sm font-mono text-zinc-800">{record.date}</p>
            </div>
            <div>
              <p className="text-[11px] text-zinc-400 mb-0.5">柜台号</p>
              <p className="text-sm text-zinc-800">{record.counterNo}</p>
            </div>
            <div>
              <p className="text-[11px] text-zinc-400 mb-0.5">柜台流水尾号</p>
              <p className="text-sm text-zinc-800">
                {record.tailNumber || (
                  <span className="text-zinc-300">未补录</span>
                )}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-[11px] text-zinc-400 mb-0.5">税费率备注</p>
              <p className="text-sm text-zinc-800">{record.taxRateRemark}</p>
            </div>
            <div>
              <p className="text-[11px] text-zinc-400 mb-0.5">审批人</p>
              <div className="flex items-center gap-2">
                <p
                  className={`text-sm ${
                    record.approverType === "pinyin"
                      ? "text-amber-600 font-semibold"
                      : "text-zinc-800"
                  }`}
                >
                  {record.approver}
                </p>
                {record.approverType === "pinyin" && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-600 border border-amber-200">
                    <AlertTriangle className="w-3 h-3" />
                    仅拼音，需客户经理复核
                  </span>
                )}
                {record.approverType === "full" && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-teal-50 text-teal-600 border border-teal-200">
                    <CheckCircle className="w-3 h-3" />
                    完整中文
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {record.status === "pending_review" && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
            <h2 className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              审批人待复核
            </h2>
            <p className="text-sm text-amber-800 mb-4">
              审批人"{record.approver}"仅留拼音，不急于归正常，请客户经理复核确认。
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleApprove}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium
                  bg-green-600 text-white hover:bg-green-700 transition-colors"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                确认（拼音对应实名）
              </button>
              <button
                onClick={handleReject}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium
                  bg-white text-red-600 border border-red-200 hover:bg-red-50 transition-colors"
              >
                <ShieldX className="w-3.5 h-3.5" />
                驳回（退回修正）
              </button>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4">
            柜台流水尾号补录
          </h2>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-[11px] text-zinc-500 mb-1">
                流水尾号
              </label>
              <input
                type="text"
                value={tailInput}
                onChange={(e) => setTailInput(e.target.value)}
                placeholder={
                  record.tailNumber
                    ? `当前：${record.tailNumber}（可覆盖）`
                    : "输入柜台流水尾号"
                }
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
              />
            </div>
            <button
              onClick={handleSupplement}
              disabled={!tailInput.trim()}
              className="px-4 py-2 rounded-lg text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 disabled:bg-zinc-200 disabled:text-zinc-400 transition-colors flex items-center gap-1.5"
            >
              <PenLine className="w-3.5 h-3.5" />
              补录
            </button>
          </div>
          <p className="mt-2 text-[10px] text-zinc-400">
            补录后余额变化表将自动联动更新
          </p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              余额变化表
            </h2>
            {!showCorrection && (
              <button
                onClick={() => setShowCorrection(true)}
                className="px-3 py-1.5 rounded-lg text-[11px] font-medium text-orange-600 bg-orange-50 border border-orange-200 hover:bg-orange-100 transition-colors"
              >
                人工修正
              </button>
            )}
          </div>

          {showCorrection && (
            <div className="mb-4 p-4 rounded-lg bg-orange-50 border border-orange-200">
              <p className="text-xs font-medium text-orange-700 mb-3">
                人工修正
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-zinc-500 mb-1">
                    修正金额
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={correctionAmount}
                    onChange={(e) => setCorrectionAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 rounded-lg border border-orange-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-zinc-500 mb-1">
                    修正原因
                  </label>
                  <input
                    type="text"
                    value={correctionReason}
                    onChange={(e) => setCorrectionReason(e.target.value)}
                    placeholder="说明修正原因"
                    className="w-full px-3 py-2 rounded-lg border border-orange-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400"
                  />
                </div>
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <button
                  onClick={() => setShowCorrection(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-zinc-500 border border-zinc-200 hover:bg-zinc-50 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleCorrection}
                  disabled={!correctionAmount || !correctionReason}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-orange-600 hover:bg-orange-700 disabled:bg-zinc-200 disabled:text-zinc-400 transition-colors"
                >
                  确认修正
                </button>
              </div>
            </div>
          )}

          <BalanceTable record={record} onRerun={handleRerun} />
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4">
            证据链时间线
          </h2>
          <AuditTimeline entries={record.auditTrail} />
        </div>
      </main>
    </div>
  )
}
