import { useAppStore } from "@/store/useAppStore"
import CaliberTag from "./CaliberTag"

export default function PendingList() {
  const selectedExperimentId = useAppStore((s) => s.selectedExperimentId)
  const experiments = useAppStore((s) => s.experiments)
  const getExperimentEvaluationRecords = useAppStore((s) => s.getExperimentEvaluationRecords)
  const confirmEvaluationRecord = useAppStore((s) => s.confirmEvaluationRecord)

  if (!selectedExperimentId) return null

  const records = getExperimentEvaluationRecords(selectedExperimentId).filter(
    (r) => r.status === "pending"
  )

  if (records.length === 0) {
    return <p className="py-4 text-sm text-slate-500">暂无待补记录</p>
  }

  return (
    <div className="flex flex-col gap-3">
      {records.map((record) => {
        const experiment = experiments.find((e) => e.id === record.experimentId)
        return (
          <div
            key={record.id}
            className="rounded-md border-l-[3px] border-red-500 bg-slate-800/60 p-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-100">
                {experiment?.name ?? record.experimentId}
              </span>
              <button
                onClick={() => confirmEvaluationRecord(record.id)}
                className="rounded bg-amber-500 px-3 py-1 text-xs font-medium text-slate-900 transition-colors hover:bg-amber-400"
              >
                确认
              </button>
            </div>
            {record.pendingItem && (
              <p className="mt-2 text-sm text-slate-300">{record.pendingItem}</p>
            )}
            {record.responsiblePerson && (
              <p className="mt-1 text-xs text-slate-400">
                负责人：{record.responsiblePerson}
              </p>
            )}
            <div className="mt-2">
              <CaliberTag label={record.caliberLabel} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
