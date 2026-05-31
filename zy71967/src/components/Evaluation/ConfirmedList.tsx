import { useAppStore } from "@/store/useAppStore"
import CaliberTag from "./CaliberTag"

export default function ConfirmedList() {
  const selectedExperimentId = useAppStore((s) => s.selectedExperimentId)
  const experiments = useAppStore((s) => s.experiments)
  const getExperimentEvaluationRecords = useAppStore((s) => s.getExperimentEvaluationRecords)

  if (!selectedExperimentId) return null

  const records = getExperimentEvaluationRecords(selectedExperimentId).filter(
    (r) => r.status === "confirmed"
  )

  if (records.length === 0) {
    return <p className="py-4 text-sm text-slate-500">暂无已确认记录</p>
  }

  return (
    <div className="flex flex-col gap-3">
      {records.map((record) => {
        const experiment = experiments.find((e) => e.id === record.experimentId)
        return (
          <div
            key={record.id}
            className="rounded-md border-l-[3px] border-emerald-500 bg-slate-800/60 p-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-100">
                {experiment?.name ?? record.experimentId}
              </span>
              <span className="text-xs text-slate-400">
                {record.modifiedAt ?? "—"}
              </span>
            </div>
            <div className="mt-2">
              <CaliberTag label={record.caliberLabel} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
