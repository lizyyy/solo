import { useDataStore } from "@/store/useDataStore"
import { getFlagColor } from "@/utils/dataQuality"
import { Check, X } from "lucide-react"

export default function SuggestionList() {
  const { records, updateFlagStatus } = useDataStore()

  const allFlags = records.flatMap((r) =>
    r.dataQualityFlags.map((f) => ({ ...f, recordId: r.id }))
  )

  const pending = allFlags.filter((f) => f.status === "pending")
  const confirmed = allFlags.filter((f) => f.status === "confirmed")
  const dismissed = allFlags.filter((f) => f.status === "dismissed")

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-base font-semibold text-zinc-900">建议操作</h2>
      <div className="mb-4 flex gap-4 text-xs text-zinc-500">
        <span>
          待处理 <span className="font-medium text-amber-600">{pending.length}</span>
        </span>
        <span>
          已确认 <span className="font-medium text-green-600">{confirmed.length}</span>
        </span>
        <span>
          已忽略 <span className="font-medium text-zinc-400">{dismissed.length}</span>
        </span>
      </div>
      <ul className="space-y-2">
        {allFlags.map((flag) => (
          <li
            key={flag.id}
            className={`flex items-start gap-2 rounded-lg border p-3 ${
              flag.status === "confirmed"
                ? "border-green-200 bg-green-50/50"
                : flag.status === "dismissed"
                  ? "border-zinc-100 bg-zinc-50/50 opacity-50"
                  : "border-zinc-200 bg-white"
            }`}
          >
            <input
              type="checkbox"
              checked={flag.status === "confirmed"}
              disabled={flag.status === "dismissed"}
              onChange={() => {
                if (flag.status === "pending") {
                  updateFlagStatus(flag.recordId, flag.id, "confirmed")
                } else if (flag.status === "confirmed") {
                  updateFlagStatus(flag.recordId, flag.id, "pending")
                }
              }}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-300 text-green-600 focus:ring-green-500"
            />
            <div className="min-w-0 flex-1">
              <p
                className={`text-sm text-zinc-700 ${
                  flag.status === "confirmed" ? "line-through text-zinc-400" : ""
                }`}
              >
                {flag.suggestedAction}
              </p>
              <span
                className={`mt-1 inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${getFlagColor(flag.type)}`}
              >
                {flag.type.replace("_", " ")}
              </span>
            </div>
            {flag.status === "pending" && (
              <button
                onClick={() => updateFlagStatus(flag.recordId, flag.id, "dismissed")}
                className="shrink-0 rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
                title="忽略"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            {flag.status === "confirmed" && (
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
            )}
          </li>
        ))}
      </ul>
      {allFlags.length === 0 && (
        <p className="py-8 text-center text-sm text-zinc-400">暂无建议</p>
      )}
    </div>
  )
}
