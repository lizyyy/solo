import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useStore } from "@/store/useStore"
import type { ManualAdjustment, IntersectionData } from "@/lib/types"
import { ArrowLeft, ArrowRight, AlertCircle, AlertTriangle, Pencil, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

type EditableField = "cycle" | "greenRatio" | "offset" | "distanceFromStart"

const FIELD_LABELS: Record<string, string> = {
  cycle: "周期(s)",
  greenRatio: "绿信比",
  offset: "偏移量(s)",
  distanceFromStart: "距起点距离(m)",
}

const EDITABLE_FIELDS: EditableField[] = ["cycle", "greenRatio", "offset", "distanceFromStart"]

export default function SupplementPage() {
  const navigate = useNavigate()
  const {
    intersections,
    validationResults,
    manualAdjustments,
    addManualAdjustment,
    setIntersections,
  } = useStore()

  const [editingField, setEditingField] = useState<{ rowIndex: number; field: string } | null>(null)
  const [editValue, setEditValue] = useState("")

  const problemResults = validationResults.filter(
    (r) => r.type === "empty" || r.type === "boundary"
  )

  const emptyResults = problemResults.filter((r) => r.type === "empty")
  const boundaryResults = problemResults.filter((r) => r.type === "boundary")

  const emptyRowCount = new Set(emptyResults.map((r) => r.rowIndex)).size
  const boundaryRowCount = new Set(boundaryResults.map((r) => r.rowIndex)).size

  const grouped = new Map<number, typeof problemResults>()
  for (const r of problemResults) {
    const existing = grouped.get(r.rowIndex) || []
    existing.push(r)
    grouped.set(r.rowIndex, existing)
  }

  const findIntersection = (rowIndex: number): IntersectionData | undefined => {
    return intersections.find((i) => i.sourceRow === rowIndex + 2)
  }

  const startEdit = (rowIndex: number, field: string, currentValue?: number) => {
    setEditingField({ rowIndex, field })
    setEditValue(currentValue !== undefined ? String(currentValue) : "")
  }

  const saveEdit = () => {
    if (!editingField) return
    const { rowIndex, field } = editingField
    const numVal = parseFloat(editValue)
    if (isNaN(numVal)) {
      setEditingField(null)
      return
    }

    const intersection = findIntersection(rowIndex)

    if (intersection) {
      const oldValue = (intersection as unknown as Record<string, unknown>)[field] as number
      const existingAdj = manualAdjustments.find(
        (a) => a.intersectionId === intersection.id && a.field === field
      )
      const adj: ManualAdjustment = {
        intersectionId: intersection.id,
        field: field as EditableField,
        originalValue: existingAdj?.originalValue ?? oldValue,
        adjustedValue: numVal,
        timestamp: new Date().toISOString(),
      }
      addManualAdjustment(adj)
      const updated = intersections.map((i) =>
        i.id === intersection.id ? { ...i, [field]: numVal } : i
      )
      setIntersections(updated)
    } else {
      const newId = `supplement-row-${rowIndex + 2}`
      const existingPartial = intersections.find((i) => i.id === newId)

      if (existingPartial) {
        const updated = intersections.map((i) =>
          i.id === newId ? { ...i, [field]: numVal } : i
        )
        setIntersections(updated)
        const adj: ManualAdjustment = {
          intersectionId: newId,
          field: field as EditableField,
          originalValue: (existingPartial as unknown as Record<string, unknown>)[field] as number,
          adjustedValue: numVal,
          timestamp: new Date().toISOString(),
        }
        addManualAdjustment(adj)
      } else {
        const newIntersection: IntersectionData = {
          id: newId,
          name: `补充路口${rowIndex + 2}`,
          distanceFromStart: field === "distanceFromStart" ? numVal : 0,
          cycle: field === "cycle" ? numVal : 120,
          greenRatio: field === "greenRatio" ? numVal : 0.5,
          offset: field === "offset" ? numVal : 0,
          direction: "上行",
          sourceRow: rowIndex + 2,
          sourceFile: "补充录入",
        }
        setIntersections([...intersections, newIntersection])
        const adj: ManualAdjustment = {
          intersectionId: newId,
          field: field as EditableField,
          originalValue: 0,
          adjustedValue: numVal,
          timestamp: new Date().toISOString(),
        }
        addManualAdjustment(adj)
      }
    }

    setEditingField(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") saveEdit()
    if (e.key === "Escape") setEditingField(null)
  }

  const isFieldEdited = (intersectionId: string, field: string) =>
    manualAdjustments.some((a) => a.intersectionId === intersectionId && a.field === field)

  return (
    <div className="min-h-screen bg-[#1A1A2E] text-gray-200 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/annotation")}
              className="p-2 rounded-lg hover:bg-[#0D7377]/30 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold">补充录入</h1>
              <p className="text-sm text-gray-400 mt-0.5">补充或修正缺失、异常的路口参数</p>
            </div>
          </div>
          <button
            onClick={() => navigate("/diff")}
            className="flex items-center gap-2 bg-[#0D7377] hover:bg-[#0D7377]/80 text-white px-4 py-2 rounded-lg transition-colors"
          >
            查看差异<ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="bg-[#16213E] rounded-lg p-4 border border-[#0D7377]/20">
            <div className="text-sm text-gray-400">路口总数</div>
            <div className="text-2xl font-bold text-white mt-1">{intersections.length}</div>
          </div>
          <div className="bg-[#16213E] rounded-lg p-4 border border-yellow-600/30">
            <div className="text-sm text-gray-400">缺失字段记录</div>
            <div className="text-2xl font-bold text-yellow-400 mt-1">{emptyRowCount}</div>
          </div>
          <div className="bg-[#16213E] rounded-lg p-4 border border-red-600/30">
            <div className="text-sm text-gray-400">边界异常记录</div>
            <div className="text-2xl font-bold text-red-400 mt-1">{boundaryRowCount}</div>
          </div>
        </div>

        {problemResults.length === 0 ? (
          <div className="bg-[#16213E] rounded-lg p-8 text-center border border-gray-700/50">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-500" />
            <p className="text-lg text-gray-300">所有路口数据完整，无需补充</p>
          </div>
        ) : (
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-[#D4A017]">
              需补充记录（共 {grouped.size} 条）
            </h2>
            <div className="space-y-4">
              {Array.from(grouped.entries()).map(([rowIndex, results]) => {
                const intersection = findIntersection(rowIndex)
                const hasEmpty = results.some((r) => r.type === "empty")

                return (
                  <div
                    key={rowIndex}
                    className="bg-[#16213E] rounded-lg p-4 border border-gray-700/50"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {hasEmpty ? (
                          <AlertCircle className="w-4 h-4 text-yellow-400" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-red-400" />
                        )}
                        <span className="font-medium">
                          {intersection ? intersection.name : `来源行 ${rowIndex + 2}`}
                        </span>
                        {intersection && (
                          <span className="text-sm text-gray-500 font-mono">
                            ({intersection.id})
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">来源行 {rowIndex + 2}</span>
                    </div>

                    {intersection && (
                      <div className="grid grid-cols-4 gap-2 mb-3 text-sm">
                        <div className="bg-[#1A1A2E] rounded px-2 py-1.5">
                          <span className="text-gray-500">距起点</span>
                          <span className="ml-2">{intersection.distanceFromStart}m</span>
                        </div>
                        <div className="bg-[#1A1A2E] rounded px-2 py-1.5">
                          <span className="text-gray-500">周期</span>
                          <span className="ml-2">{intersection.cycle}s</span>
                        </div>
                        <div className="bg-[#1A1A2E] rounded px-2 py-1.5">
                          <span className="text-gray-500">绿信比</span>
                          <span className="ml-2">{intersection.greenRatio}</span>
                        </div>
                        <div className="bg-[#1A1A2E] rounded px-2 py-1.5">
                          <span className="text-gray-500">偏移量</span>
                          <span className="ml-2">{intersection.offset}s</span>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      {results.map((r) => {
                        const isEditing =
                          editingField?.rowIndex === rowIndex &&
                          editingField?.field === r.field
                        const isEditable = EDITABLE_FIELDS.includes(r.field as EditableField)
                        const currentValue = intersection
                          ? (intersection as unknown as Record<string, unknown>)[r.field] as number | undefined
                          : undefined
                        const edited = intersection
                          ? isFieldEdited(intersection.id, r.field)
                          : manualAdjustments.some(
                              (a) =>
                                a.intersectionId === `supplement-row-${rowIndex + 2}` &&
                                a.field === r.field
                            )

                        return (
                          <div
                            key={r.id}
                            className={cn(
                              "flex items-center gap-3 rounded-lg px-3 py-2",
                              r.type === "empty" ? "bg-yellow-900/20" : "bg-red-900/20"
                            )}
                          >
                            {r.type === "empty" ? (
                              <AlertCircle className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                            ) : (
                              <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                            )}
                            <span className="text-sm flex-1">{r.message}</span>

                            {isEditable &&
                              (isEditing ? (
                                <input
                                  type="number"
                                  step={r.field === "greenRatio" ? 0.01 : 1}
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onKeyDown={handleKeyDown}
                                  onBlur={saveEdit}
                                  autoFocus
                                  className="w-24 bg-[#0D7377] text-white px-2 py-1 rounded text-center text-sm outline-none"
                                />
                              ) : (
                                <button
                                  onClick={() => startEdit(rowIndex, r.field, currentValue)}
                                  className={cn(
                                    "flex items-center gap-1 px-3 py-1 rounded text-sm transition-colors",
                                    edited
                                      ? "bg-[#D4A017]/20 text-[#D4A017] hover:bg-[#D4A017]/30"
                                      : "bg-[#0D7377]/20 text-[#0D7377] hover:bg-[#0D7377]/30"
                                  )}
                                >
                                  <Pencil className="w-3 h-3" />
                                  {currentValue !== undefined
                                    ? `编辑 (${FIELD_LABELS[r.field] ?? r.field}: ${currentValue})`
                                    : "补充"}
                                </button>
                              ))}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
