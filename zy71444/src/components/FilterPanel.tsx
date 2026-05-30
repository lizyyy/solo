import { EXPIRY_BUCKETS } from "@/data/mockData"
import { useFilterStore } from "@/stores/useFilterStore"
import { useAuditStore } from "@/stores/useAuditStore"
import type { GreekKey } from "@/data/types"

const GREEK_OPTIONS: { key: GreekKey; symbol: string; label: string }[] = [
  { key: "delta", symbol: "Δ", label: "Delta" },
  { key: "gamma", symbol: "Γ", label: "Gamma" },
  { key: "vega", symbol: "ν", label: "Vega" },
]

export default function FilterPanel() {
  const { activeGreeks, activeBuckets, thresholdValue, toggleGreek, toggleBucket, setThreshold } =
    useFilterStore()
  const logAction = useAuditStore((s) => s.logAction)

  function handleToggleBucket(bucketId: string) {
    toggleBucket(bucketId)
    const next = activeBuckets.includes(bucketId)
      ? activeBuckets.filter((b) => b !== bucketId)
      : [...activeBuckets, bucketId]
    logAction("FILTER_BUCKET_TOGGLE", `${next.includes(bucketId) ? "启用" : "禁用"}到期桶 ${bucketId}`)
  }

  function handleToggleGreek(greek: GreekKey) {
    toggleGreek(greek)
    const next = activeGreeks.includes(greek)
      ? activeGreeks.filter((g) => g !== greek)
      : [...activeGreeks, greek]
    logAction("FILTER_GREEK_TOGGLE", `${next.includes(greek) ? "启用" : "禁用"}${greek}`)
  }

  function handleThresholdChange(value: number) {
    setThreshold(value)
    logAction("FILTER_THRESHOLD", `设置敞口阈值为 ${value}`)
  }

  return (
    <aside className="flex h-full w-[260px] shrink-0 flex-col gap-6 border-r border-gray-800 bg-[#0d1117] p-4 overflow-y-auto">
      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
          到期桶筛选
        </h3>
        <div className="flex flex-col gap-1.5">
          {EXPIRY_BUCKETS.map((bucket) => {
            const checked = activeBuckets.includes(bucket.id)
            return (
              <label
                key={bucket.id}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-gray-300 hover:bg-gray-800/50"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => handleToggleBucket(bucket.id)}
                  className="sr-only"
                />
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded border ${
                    checked ? "border-transparent" : "border-gray-600"
                  }`}
                  style={{ backgroundColor: checked ? bucket.color : "transparent" }}
                >
                  {checked && (
                    <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </span>
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: bucket.color }}
                />
                <span>{bucket.label}</span>
              </label>
            )
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
          希腊值维度
        </h3>
        <div className="flex gap-2">
          {GREEK_OPTIONS.map((opt) => {
            const active = activeGreeks.includes(opt.key)
            return (
              <button
                key={opt.key}
                onClick={() => handleToggleGreek(opt.key)}
                className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg border px-2 py-2 text-xs transition-colors ${
                  active
                    ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-400"
                    : "border-gray-700 bg-gray-800/30 text-gray-500 hover:border-gray-600"
                }`}
              >
                <span className="text-base leading-none">{opt.symbol}</span>
                <span>{opt.label}</span>
              </button>
            )
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
          敞口阈值
        </h3>
        <div className="flex flex-col gap-2">
          <input
            type="range"
            min={0}
            max={500}
            step={5}
            value={thresholdValue}
            onChange={(e) => handleThresholdChange(Number(e.target.value))}
            className="w-full accent-cyan-500"
          />
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={500}
              value={thresholdValue}
              onChange={(e) => {
                const v = Math.min(500, Math.max(0, Number(e.target.value) || 0))
                handleThresholdChange(v)
              }}
              className="w-20 rounded border border-gray-700 bg-[#161b22] px-2 py-1 text-xs text-gray-300 focus:border-cyan-500 focus:outline-none"
            />
            <span className="text-xs text-gray-500">0 – 500</span>
          </div>
        </div>
      </section>
    </aside>
  )
}
