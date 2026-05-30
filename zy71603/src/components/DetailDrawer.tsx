import { useMemo } from "react"
import { X, Download } from "lucide-react"
import type { DetailItem } from "@/engine/types"
import { exportDetailItemsToCSV } from "@/utils/csvExport"
import { useAnalysisStore } from "@/store/useAnalysisStore"

const severityRowClass: Record<string, string> = {
  normal: "",
  warning: "bg-amber-900/20",
  error: "bg-red-900/20",
}

const severityCellClass: Record<string, string> = {
  normal: "",
  warning: "text-amber-300",
  error: "text-red-300",
}

export default function DetailDrawer() {
  const detailItems: DetailItem[] = useAnalysisStore((s) => s.detailItems)
  const detailTitle = useAnalysisStore((s) => s.detailTitle)
  const closeDetail = useAnalysisStore((s) => s.closeDetail)

  const isOpen = detailItems.length > 0

  const columns = useMemo(() => {
    if (detailItems.length === 0) return []
    const first = detailItems[0]
    return Object.keys(first).filter(
      (k) => k !== "id" && typeof first[k] !== "object"
    )
  }, [detailItems])

  const handleExport = () => {
    exportDetailItemsToCSV(detailItems, detailTitle)
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={closeDetail}
      />
      <div
        className={`fixed top-0 right-0 z-50 h-full w-[480px] transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ backgroundColor: "#1e2230", color: "#f0ece4" }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-semibold truncate">{detailTitle}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm hover:bg-white/10 transition-colors"
            >
              <Download size={16} />
              <span>导出</span>
            </button>
            <button
              onClick={closeDetail}
              className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="overflow-auto" style={{ height: "calc(100% - 65px)" }}>
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10" style={{ backgroundColor: "#1e2230" }}>
              <tr className="border-b border-white/10">
                {columns.map((col) => (
                  <th
                    key={col}
                    className="px-4 py-3 text-left font-medium text-white/60 whitespace-nowrap"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {detailItems.map((item, idx) => {
                const severity = (item.severity as string) || "normal"
                return (
                  <tr
                    key={item.id ?? idx}
                    className={`border-b border-white/5 hover:bg-white/5 transition-colors ${severityRowClass[severity] || ""}`}
                  >
                    {columns.map((col) => (
                      <td
                        key={col}
                        className={`px-4 py-2.5 whitespace-nowrap ${severityCellClass[severity] || ""}`}
                      >
                        {String(item[col] ?? "")}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
