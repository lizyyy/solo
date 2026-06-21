import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useStore } from "@/store/useStore"
import type { ManualAdjustment, IntersectionData } from "@/lib/types"
import { ArrowLeft, Pencil, Download, Trash2, RefreshCw, Filter, GitCompare, FileText } from "lucide-react"
import { cn } from "@/lib/utils"

type EditableField = "offset" | "greenRatio" | "cycle"
type FilterType = "全部" | "上行" | "下行"

const FIELD_LABELS: Record<string, string> = {
  offset: "偏移量",
  greenRatio: "绿信比",
  cycle: "周期",
}

export default function AdjustPage() {
  const navigate = useNavigate()
  const {
    intersections,
    setIntersections,
    speedBandResults,
    manualAdjustments,
    addManualAdjustment,
    activeFilter,
    setActiveFilter,
    recalculate,
  } = useStore()

  const [editingCell, setEditingCell] = useState<{ id: string; field: EditableField } | null>(null)
  const [editValue, setEditValue] = useState("")
  const [exportConfirm, setExportConfirm] = useState(false)

  const getFilteredIntersections = (): IntersectionData[] => {
    if (activeFilter === "全部") return intersections
    return intersections.filter((i) => i.direction === activeFilter)
  }

  const getFilteredResults = () => {
    if (activeFilter === "全部") return speedBandResults
    const filteredIds = new Set(getFilteredIntersections().map((i) => i.name))
    return speedBandResults.filter(
      (r) => filteredIds.has(r.fromIntersection) && filteredIds.has(r.toIntersection)
    )
  }

  const isEdited = (id: string, field: string) =>
    manualAdjustments.some((a) => a.intersectionId === id && a.field === field)

  const getOriginalValue = (id: string, field: string) =>
    manualAdjustments.find((a) => a.intersectionId === id && a.field === field)?.originalValue

  const startEdit = (id: string, field: EditableField, currentValue: number) => {
    setEditingCell({ id, field })
    setEditValue(String(currentValue))
  }

  const saveEdit = () => {
    if (!editingCell) return
    const { id, field } = editingCell
    const numVal = parseFloat(editValue)
    if (isNaN(numVal)) {
      setEditingCell(null)
      return
    }

    const intersection = intersections.find((i) => i.id === id)
    if (!intersection) {
      setEditingCell(null)
      return
    }

    const oldValue = intersection[field]
    if (oldValue === numVal) {
      setEditingCell(null)
      return
    }

    const adj: ManualAdjustment = {
      intersectionId: id,
      field,
      originalValue: isEdited(id, field) ? getOriginalValue(id, field)! : oldValue,
      adjustedValue: numVal,
      timestamp: new Date().toISOString(),
    }
    addManualAdjustment(adj)

    const updated = intersections.map((i) =>
      i.id === id ? { ...i, [field]: numVal } : i
    )
    setIntersections(updated)
    recalculate()
    setEditingCell(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") saveEdit()
    if (e.key === "Escape") setEditingCell(null)
  }

  const recalcBtn = () => {
    recalculate()
  }

  const removeAdjustment = (adj: ManualAdjustment) => {
    const updatedAdjustments = manualAdjustments.filter(
      (a) => !(a.intersectionId === adj.intersectionId && a.field === adj.field)
    )
    const updatedIntersections = intersections.map((i) => {
      if (i.id === adj.intersectionId && adj.field in i) {
        return { ...i, [adj.field]: adj.originalValue }
      }
      return i
    })
    useStore.setState({ manualAdjustments: updatedAdjustments })
    setIntersections(updatedIntersections)
    recalculate()
  }

  const exportCSV = () => {
    recalculate()
    const filtered = getFilteredResults()
    const header =
      "段编号,起点,终点,距离(m),速度下限(km/h),速度上限(km/h),带宽(s),是否异常,异常原因"
    const rows = filtered.map((r) =>
      `${r.segmentIndex},${r.fromIntersection},${r.toIntersection},${r.distance},${r.speedMin},${r.speedMax},${r.bandwidth},${r.isAnomalous ? "是" : "否"},${r.anomalyReason || ""}`
    )
    const csv = [header, ...rows].join("\n")
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `绿波速度带_${activeFilter}_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    setExportConfirm(false)
  }

  const filteredIntersections = getFilteredIntersections()

  const renderEditableCell = (
    intersection: IntersectionData,
    field: EditableField,
    value: number
  ) => {
    const isEditing =
      editingCell?.id === intersection.id && editingCell?.field === field
    const edited = isEdited(intersection.id, field)
    const origVal = getOriginalValue(intersection.id, field)

    if (isEditing) {
      return (
        <input
          type="number"
          step={field === "greenRatio" ? 0.01 : 1}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={saveEdit}
          onKeyDown={handleKeyDown}
          autoFocus
          className="w-20 bg-[#0D7377] text-white px-2 py-1 rounded text-center outline-none"
        />
      )
    }

    return (
      <div
        className="flex items-center gap-1 cursor-pointer group"
        onClick={() => startEdit(intersection.id, field, value)}
      >
        <span className={cn(edited && "text-[#D4A017] font-semibold")}>
          {field === "greenRatio" ? value.toFixed(2) : value}
        </span>
        {edited && (
          <div className="flex items-center gap-1" title={`原始值: ${origVal}`}>
            <Pencil className="w-3 h-3 text-[#D4A017]" />
            <span className="text-xs text-gray-500">({origVal})</span>
          </div>
        )}
        <span className="text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity text-xs">
          ✎
        </span>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#1A1A2E] text-gray-200 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-[#0D7377]/30 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold">调参与重算</h1>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Filter className="w-4 h-4 text-[#0D7377]" />
            <div className="flex bg-[#16213E] rounded-lg overflow-hidden">
              {(["全部", "上行", "下行"] as FilterType[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setActiveFilter(f)}
                  className={cn(
                    "px-4 py-1.5 text-sm transition-colors",
                    activeFilter === f
                      ? "bg-[#0D7377] text-white"
                      : "text-gray-400 hover:text-gray-200"
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
            <span className="text-sm text-gray-400">
              当前筛选：{activeFilter}
            </span>
          </div>
          <button
            onClick={recalcBtn}
            className="flex items-center gap-2 bg-[#0D7377] hover:bg-[#0D7377]/80 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            重新计算
          </button>
        </div>

        <div className="overflow-x-auto rounded-lg border border-[#0D7377]/30">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#16213E] text-gray-400">
                <th className="px-3 py-2.5 text-left">路口编号</th>
                <th className="px-3 py-2.5 text-left">名称</th>
                <th className="px-3 py-2.5 text-right">距起点距离(m)</th>
                <th className="px-3 py-2.5 text-center">周期(s)</th>
                <th className="px-3 py-2.5 text-center">绿信比</th>
                <th className="px-3 py-2.5 text-center">偏移量(s)</th>
                <th className="px-3 py-2.5 text-center">方向</th>
                <th className="px-3 py-2.5 text-center">来源</th>
              </tr>
            </thead>
            <tbody>
              {filteredIntersections.map((item) => (
                <tr
                  key={item.id}
                  className="border-t border-[#0D7377]/10 hover:bg-[#16213E]/50"
                >
                  <td className="px-3 py-2 font-mono">{item.id}</td>
                  <td className="px-3 py-2">{item.name}</td>
                  <td className="px-3 py-2 text-right">{item.distanceFromStart}</td>
                  <td className="px-3 py-2 text-center">
                    {renderEditableCell(item, "cycle", item.cycle)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {renderEditableCell(item, "greenRatio", item.greenRatio)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {renderEditableCell(item, "offset", item.offset)}
                  </td>
                  <td className="px-3 py-2 text-center">{item.direction}</td>
                  <td className="px-3 py-2 text-center text-xs text-gray-500">{item.sourceFile}:L{item.sourceRow}</td>
                </tr>
              ))}
              {filteredIntersections.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-gray-500">
                    暂无路口数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-4">
          {!exportConfirm ? (
            <button
              onClick={() => setExportConfirm(true)}
              className="flex items-center gap-2 bg-[#D4A017]/20 hover:bg-[#D4A017]/30 text-[#D4A017] px-4 py-2 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              导出CSV
            </button>
          ) : (
            <div className="flex items-center gap-3 bg-[#16213E] px-4 py-2 rounded-lg">
              <span className="text-sm">
                将导出 {activeFilter} 下的 {getFilteredResults().length} 条记录
              </span>
              <button
                onClick={exportCSV}
                className="px-3 py-1 bg-[#0D7377] text-white text-sm rounded hover:bg-[#0D7377]/80 transition-colors"
              >
                确认
              </button>
              <button
                onClick={() => setExportConfirm(false)}
                className="px-3 py-1 bg-gray-700 text-gray-300 text-sm rounded hover:bg-gray-600 transition-colors"
              >
                取消
              </button>
            </div>
          )}
        </div>

        {manualAdjustments.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">人工调参记录</h2>
            <div className="space-y-2">
              {manualAdjustments.map((adj, idx) => (
                <div
                  key={`${adj.intersectionId}-${adj.field}-${idx}`}
                  className="flex items-center justify-between bg-[#16213E] px-4 py-3 rounded-lg"
                >
                  <div className="flex items-center gap-4 text-sm">
                    <span className="font-mono text-[#D4A017]">{adj.intersectionId}</span>
                    <span className="text-gray-400">{FIELD_LABELS[adj.field]}</span>
                    <span>
                      <span className="text-gray-500">{adj.originalValue}</span>
                      <span className="mx-1 text-gray-600">→</span>
                      <span className="text-[#D4A017] font-semibold">{adj.adjustedValue}</span>
                    </span>
                    <span className="text-gray-600 text-xs">
                      {new Date(adj.timestamp).toLocaleString("zh-CN")}
                    </span>
                  </div>
                  <button
                    onClick={() => removeAdjustment(adj)}
                    className="flex items-center gap-1 text-red-400 hover:text-red-300 text-sm transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    清除
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 pt-4">
          <button
            onClick={() => navigate("/diff")}
            className="flex items-center gap-2 px-4 py-2 bg-[#0D7377]/20 hover:bg-[#0D7377]/30 text-[#0D7377] rounded-lg transition-colors text-sm font-medium"
          >
            <GitCompare className="w-4 h-4" />
            差异对比
          </button>
          <button
            onClick={() => navigate("/report")}
            className="flex items-center gap-2 px-4 py-2 bg-[#D4A017]/20 hover:bg-[#D4A017]/30 text-[#D4A017] rounded-lg transition-colors text-sm font-medium"
          >
            <FileText className="w-4 h-4" />
            查看报告
          </button>
        </div>
      </div>
    </div>
  )
}
