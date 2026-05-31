import { useState } from "react"
import { X } from "lucide-react"
import { useAppStore } from "@/store/useAppStore"
import CaliberTag from "./CaliberTag"

function RejectModal({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  onConfirm: (reason: string) => void
}) {
  const [reason, setReason] = useState("")

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-96 rounded-lg bg-slate-800 p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-100">驳回原因</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X size={16} />
          </button>
        </div>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="mt-3 h-28 w-full rounded border border-slate-600 bg-slate-900 p-2 text-sm text-slate-100 outline-none focus:border-amber-500"
          placeholder="请输入驳回原因..."
        />
        <div className="mt-3 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
          >
            取消
          </button>
          <button
            onClick={() => {
              if (reason.trim()) {
                onConfirm(reason.trim())
                setReason("")
                onClose()
              }
            }}
            className="rounded bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-400"
          >
            确认驳回
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ModifiedList() {
  const selectedExperimentId = useAppStore((s) => s.selectedExperimentId)
  const experiments = useAppStore((s) => s.experiments)
  const getExperimentEvaluationRecords = useAppStore((s) => s.getExperimentEvaluationRecords)
  const confirmEvaluationRecord = useAppStore((s) => s.confirmEvaluationRecord)
  const rejectEvaluationRecord = useAppStore((s) => s.rejectEvaluationRecord)

  const [rejectingId, setRejectingId] = useState<string | null>(null)

  if (!selectedExperimentId) return null

  const records = getExperimentEvaluationRecords(selectedExperimentId).filter(
    (r) => r.status === "manual_modified"
  )

  if (records.length === 0) {
    return <p className="py-4 text-sm text-slate-500">暂无人工改动记录</p>
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {records.map((record) => {
          const experiment = experiments.find((e) => e.id === record.experimentId)
          return (
            <div
              key={record.id}
              className="rounded-md border-l-[3px] border-slate-400 bg-slate-800/60 p-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-100">
                  {experiment?.name ?? record.experimentId}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => confirmEvaluationRecord(record.id)}
                    className="rounded bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-500/30"
                  >
                    通过
                  </button>
                  <button
                    onClick={() => setRejectingId(record.id)}
                    className="rounded bg-red-500/20 px-3 py-1 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/30"
                  >
                    驳回
                  </button>
                </div>
              </div>

              {record.originalValue != null && record.modifiedValue != null && (
                <div className="mt-2 flex items-center gap-2 text-sm">
                  <span className="line-through text-slate-500">{record.originalValue}</span>
                  <span className="text-slate-400">→</span>
                  <span className="text-amber-400">{record.modifiedValue}</span>
                </div>
              )}

              {record.modificationReason && (
                <p className="mt-2 text-sm text-slate-300">
                  原因：{record.modificationReason}
                </p>
              )}

              <div className="mt-2 flex items-center gap-4 text-xs text-slate-400">
                {record.modifiedBy && <span>修改人：{record.modifiedBy}</span>}
                {record.modifiedAt && <span>修改时间：{record.modifiedAt}</span>}
              </div>

              <div className="mt-2">
                <CaliberTag label={record.caliberLabel} />
              </div>
            </div>
          )
        })}
      </div>

      <RejectModal
        open={rejectingId !== null}
        onClose={() => setRejectingId(null)}
        onConfirm={(reason) => {
          if (rejectingId) {
            rejectEvaluationRecord(rejectingId, reason)
          }
        }}
      />
    </>
  )
}
