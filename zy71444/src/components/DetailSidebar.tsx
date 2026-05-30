import { useState } from "react"
import { X, ChevronDown, ChevronRight, AlertTriangle } from "lucide-react"
import { useSelectionStore } from "@/stores/useSelectionStore"
import { useAuditStore } from "@/stores/useAuditStore"
import PositionTable from "./PositionTable"
import IntermediatePanel from "./IntermediatePanel"

function formatNum(v: number) {
  return v.toLocaleString("zh-CN", { maximumFractionDigits: 2 })
}

export default function DetailSidebar() {
  const { selectedExposure, selectExposure } = useSelectionStore()
  const logAction = useAuditStore((s) => s.logAction)
  const [collapsed, setCollapsed] = useState(false)

  if (!selectedExposure) return null

  function handleClose() {
    logAction("DESELECT_EXPOSURE", `取消选中 ${selectedExposure.clientName}`)
    selectExposure(null)
  }

  if (collapsed) {
    return (
      <aside className="flex h-full w-10 shrink-0 items-center justify-center border-l border-gray-800 bg-[#0d1117]">
        <button
          onClick={() => setCollapsed(false)}
          className="text-gray-500 hover:text-gray-300"
          title="展开详情"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </aside>
    )
  }

  return (
    <aside className="flex h-full w-[340px] shrink-0 flex-col border-l border-gray-800 bg-[#0d1117]">
      <div className="flex items-center gap-2 border-b border-gray-800 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: selectedExposure.bucketColor }}
            />
            <span className="truncate text-sm font-semibold text-gray-200">
              {selectedExposure.clientName}
            </span>
            <span className="shrink-0 rounded bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-400">
              {selectedExposure.clientCode}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-gray-500">{selectedExposure.bucketLabel}</p>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          className="shrink-0 text-gray-600 hover:text-gray-400"
          title="折叠"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
        <button
          onClick={handleClose}
          className="shrink-0 text-gray-600 hover:text-gray-400"
          title="关闭"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            希腊值
          </h4>
          <div className="grid grid-cols-3 gap-2">
            <GreekCard label="Delta" symbol="Δ" value={selectedExposure.delta} color="#3b82f6" />
            <GreekCard label="Gamma" symbol="Γ" value={selectedExposure.gamma} color="#8b5cf6" />
            <GreekCard label="Vega" symbol="ν" value={selectedExposure.vega} color="#f59e0b" />
          </div>
        </section>

        {selectedExposure.hasAnomaly && selectedExposure.anomalyType.length > 0 && (
          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
              异常预警
            </h4>
            <div className="flex flex-col gap-1.5">
              {selectedExposure.anomalyType.map((type) => (
                <div
                  key={type}
                  className={`flex items-center gap-2 rounded px-3 py-2 text-xs ${
                    type === "BUCKET_MISMATCH"
                      ? "bg-red-900/20 text-red-400 border border-red-800/40"
                      : "bg-yellow-900/20 text-yellow-400 border border-yellow-800/40"
                  }`}
                >
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    {type === "BUCKET_MISMATCH" ? "到期桶不匹配" : "Delta符号反转"}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            持仓明细
          </h4>
          <PositionTable positions={selectedExposure.positions} />
        </section>

        {selectedExposure.intermediateSteps.length > 0 && (
          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
              中间计算步骤
            </h4>
            <IntermediatePanel steps={selectedExposure.intermediateSteps} />
          </section>
        )}
      </div>
    </aside>
  )
}

function GreekCard({
  label,
  symbol,
  value,
  color,
}: {
  label: string
  symbol: string
  value: number
  color: string
}) {
  return (
    <div className="rounded-lg border border-gray-700 bg-[#161b22] px-3 py-2 text-center">
      <div className="text-[10px] text-gray-500">{label}</div>
      <div className="text-lg font-bold" style={{ color }}>
        {symbol}
      </div>
      <div className="text-xs text-gray-300">{formatNum(value)}</div>
    </div>
  )
}
