import { useState } from "react"
import { useStore } from "@/store/useStore"
import type { ConflictEvidence, ApprovalAction, ObstructionPoint } from "@/types"
import { SOURCE_LABELS } from "@/types"
import StatusBadge from "@/components/StatusBadge"
import { AlertTriangle, CheckCircle2, XCircle, FileText } from "lucide-react"

function ConflictPanel({ recordId }: { recordId: string }) {
  const { records, remarks, getConflictsForRecord, approveConflict, obstructionPoints } = useStore()
  const [reason, setReason] = useState("")
  const [resolved, setResolved] = useState(false)

  const record = records.find((r) => r.id === recordId)
  const remark = remarks.find((r) => r.recordId === recordId)
  const conflicts = getConflictsForRecord(recordId)
  if (!record || !remark) return null

  const relatedPoints = obstructionPoints.filter((p) => p.recordId === recordId)
  const alreadyResolved = relatedPoints.some(
    (p) => p.status === "supplemented" || p.status === "rejected"
  )
  const isDisabled = resolved || alreadyResolved

  const handleAction = (pointId: string, action: "confirm" | "reject") => {
    if (!reason.trim()) return
    const approval: ApprovalAction = {
      action,
      operator: "设备工程师-许工",
      reason: reason.trim(),
      timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
    }
    approveConflict(pointId, approval)
    setResolved(true)
  }

  return (
    <div className="rounded-lg border bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <AlertTriangle className="h-4 w-4 text-rose-500" />
        <span className="font-medium">{record.slopeName}</span>
        <StatusBadge status="conflict" />
      </div>
      <div className="grid grid-cols-2 divide-x">
        <div className="p-4">
          <h4 className="mb-2 text-sm font-semibold text-slate-700">测距仪记录</h4>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500">
                <th className="py-1 text-left font-medium">序号</th>
                <th className="py-1 text-right font-medium">经度</th>
                <th className="py-1 text-right font-medium">纬度</th>
                <th className="py-1 text-right font-medium">海拔</th>
              </tr>
            </thead>
            <tbody>
              {record.coordinateRows.map((cr) => (
                <tr key={cr.id} className="border-t">
                  <td className="py-1">{cr.sequenceNumber}</td>
                  <td className="py-1 text-right">{cr.longitude.toFixed(6)}</td>
                  <td className="py-1 text-right">{cr.latitude.toFixed(6)}</td>
                  <td className="py-1 text-right">{cr.elevation.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4">
          <h4 className="mb-2 text-sm font-semibold text-slate-700">障碍物备注</h4>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500">
                <th className="py-1 text-left font-medium">序号</th>
                <th className="py-1 text-right font-medium">经度</th>
                <th className="py-1 text-right font-medium">纬度</th>
                <th className="py-1 text-left font-medium">描述</th>
              </tr>
            </thead>
            <tbody>
              {remark.entries.map((e) => (
                <tr key={e.id} className="border-t">
                  <td className="py-1">{e.sequenceNumber}</td>
                  <td className="py-1 text-right">{e.longitude.toFixed(6)}</td>
                  <td className="py-1 text-right">{e.latitude.toFixed(6)}</td>
                  <td className="py-1">{e.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {conflicts.length > 0 && (
        <div className="mx-4 mb-4 rounded bg-rose-500/10 p-3">
          <h4 className="mb-1 text-xs font-semibold text-rose-700">冲突证据</h4>
          {conflicts.map((c: ConflictEvidence, i: number) => (
            <div key={i} className="mb-1 text-xs text-rose-600">
              <span className="font-medium">{c.field}</span>：
              测距仪 <span className="font-mono">{c.rangefinderValue}</span> vs 备注{" "}
              <span className="font-mono">{c.remarkValue}</span>
              <span className="ml-2 text-slate-400">{c.timestamp}</span>
            </div>
          ))}
        </div>
      )}
      <div className="border-t px-4 py-3">
        <h4 className="mb-2 text-sm font-semibold text-slate-700">
          <FileText className="mr-1 inline h-3.5 w-3.5" />
          工程师审批
        </h4>
        <textarea
          className="mb-2 w-full rounded border px-3 py-2 text-sm disabled:bg-slate-50"
          rows={2}
          placeholder="输入取舍理由（必填）"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={isDisabled}
        />
        <div className="flex gap-2">
          <button
            className="flex items-center gap-1 rounded bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700 disabled:opacity-50"
            disabled={isDisabled || !reason.trim()}
            onClick={() => {
              const point = relatedPoints[0]
              if (point) handleAction(point.id, "confirm")
            }}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            确认（采用障碍物备注）
          </button>
          <button
            className="flex items-center gap-1 rounded bg-rose-600 px-3 py-1.5 text-sm text-white hover:bg-rose-700 disabled:opacity-50"
            disabled={isDisabled || !reason.trim()}
            onClick={() => {
              const point = relatedPoints[0]
              if (point) handleAction(point.id, "reject")
            }}
          >
            <XCircle className="h-3.5 w-3.5" />
            驳回（保留测距仪记录）
          </button>
        </div>
        {isDisabled && (
          <p className="mt-2 text-xs text-slate-500">已处理审批决定</p>
        )}
      </div>
    </div>
  )
}

function PendingPointCard({ point }: { point: ObstructionPoint }) {
  const { reviewPendingPoint } = useStore()
  const [reason, setReason] = useState("")

  const isReviewed = point.status !== "pending_review"

  const handleReview = (approved: boolean) => {
    if (!reason.trim()) return
    reviewPendingPoint(point.id, approved, reason.trim())
  }

  return (
    <div className="border-l-4 border-l-amber-500 rounded-r-lg border border-t border-r border-b bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <span className="font-medium">{point.label}</span>
        <StatusBadge status={point.status} />
      </div>
      <div className="mb-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
        <div>经度：{point.longitude.toFixed(6)}</div>
        <div>纬度：{point.latitude.toFixed(6)}</div>
        <div>原因：{point.reason || "—"}</div>
        <div>来源：{SOURCE_LABELS[point.sourceType]}</div>
      </div>
      <textarea
        className="mb-2 w-full rounded border px-3 py-1.5 text-xs disabled:bg-slate-50"
        rows={2}
        placeholder="输入复核理由（必填）"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        disabled={isReviewed}
      />
      <div className="flex gap-2">
        <button
          className="flex items-center gap-1 rounded bg-emerald-600 px-3 py-1 text-xs text-white hover:bg-emerald-700 disabled:opacity-50"
          disabled={isReviewed || !reason.trim()}
          onClick={() => handleReview(true)}
        >
          <CheckCircle2 className="h-3 w-3" />
          通过
        </button>
        <button
          className="flex items-center gap-1 rounded bg-rose-600 px-3 py-1 text-xs text-white hover:bg-rose-700 disabled:opacity-50"
          disabled={isReviewed || !reason.trim()}
          onClick={() => handleReview(false)}
        >
          <XCircle className="h-3 w-3" />
          驳回
        </button>
      </div>
    </div>
  )
}

export default function ReviewPage() {
  const { records, importedRecordIds, reviewedRecordIds, obstructionPoints } = useStore()

  const conflictRecordIds = records
    .filter((r) => importedRecordIds.includes(r.id) && reviewedRecordIds.includes(r.id) && r.status === "conflict")
    .map((r) => r.id)

  const pendingPoints = obstructionPoints.filter((p) => p.status === "pending_review")

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <section>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-800">
          <AlertTriangle className="h-5 w-5 text-rose-500" />
          冲突检测
        </h2>
        {conflictRecordIds.length === 0 ? (
          <p className="text-sm text-slate-400">暂无冲突记录</p>
        ) : (
          <div className="space-y-4">
            {conflictRecordIds.map((id) => (
              <ConflictPanel key={id} recordId={id} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-800">
          <FileText className="h-5 w-5 text-amber-500" />
          安全员复核队列
        </h2>
        {pendingPoints.length === 0 ? (
          <p className="text-sm text-slate-400">暂无待复核点位</p>
        ) : (
          <div className="space-y-3">
            {pendingPoints.map((p) => (
              <PendingPointCard key={p.id} point={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
