import { useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { useStore } from "@/store/useStore"
import { ArrowLeft, ArrowRight, Tag, CheckCircle2, HelpCircle, AlertTriangle, CircleDot } from "lucide-react"
import { cn } from "@/lib/utils"

type AnnotationType = "已确认" | "待核实" | "有疑问" | "异常" | ""

const ANNOTATION_OPTIONS: AnnotationType[] = ["", "已确认", "待核实", "有疑问", "异常"]

const ANNOTATION_STYLES: Record<string, { bg: string; text: string; icon: typeof CheckCircle2 }> = {
  "已确认": { bg: "bg-emerald-900/40", text: "text-emerald-400", icon: CheckCircle2 },
  "待核实": { bg: "bg-amber-900/40", text: "text-amber-400", icon: CircleDot },
  "有疑问": { bg: "bg-orange-900/40", text: "text-orange-400", icon: HelpCircle },
  "异常": { bg: "bg-red-900/40", text: "text-red-400", icon: AlertTriangle },
}

const ANNOTATION_CARD_STYLES: Record<string, { border: string; icon: typeof CheckCircle2 }> = {
  "已确认": { border: "border-emerald-700/50", icon: CheckCircle2 },
  "待核实": { border: "border-amber-700/50", icon: CircleDot },
  "有疑问": { border: "border-orange-700/50", icon: HelpCircle },
  "异常": { border: "border-red-700/50", icon: AlertTriangle },
}

export default function AnnotationPage() {
  const navigate = useNavigate()
  const {
    intersections,
    validationResults,
    activeFilter,
    annotations,
    setAnnotation,
  } = useStore()

  const filteredIntersections = useMemo(() => {
    if (activeFilter === "全部") return intersections
    return intersections.filter((i) => i.direction === activeFilter)
  }, [intersections, activeFilter])

  const validationMap = useMemo(() => {
    const map = new Map<string, typeof validationResults>()
    for (const vr of validationResults) {
      const intersection = intersections.find((i) => i.sourceRow === vr.rowIndex + 1)
      if (intersection) {
        const existing = map.get(intersection.id) || []
        map.set(intersection.id, [...existing, vr])
      }
    }
    return map
  }, [validationResults, intersections])

  const annotationCounts = useMemo(() => {
    const counts: Record<string, number> = { "已确认": 0, "待核实": 0, "有疑问": 0, "异常": 0 }
    for (const intersection of filteredIntersections) {
      const ann = annotations[intersection.id] || ""
      if (ann && ann in counts) {
        counts[ann]++
      }
    }
    return counts
  }, [filteredIntersections, annotations])

  const hasValidationIssue = (id: string) => validationMap.has(id)

  return (
    <div className="min-h-screen bg-[#1A1A2E] text-gray-200 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/calculate")}
              className="p-2 rounded-lg hover:bg-[#0D7377]/30 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-bold">路口标注</h1>
          </div>
          <button
            onClick={() => navigate("/supplement")}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#0D7377] hover:bg-[#0D7377]/80 text-white rounded-lg font-semibold transition-colors"
          >
            下一步
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(["已确认", "待核实", "有疑问", "异常"] as const).map((type) => {
            const card = ANNOTATION_CARD_STYLES[type]
            const Icon = card.icon
            return (
              <div
                key={type}
                className={cn(
                  "bg-[#16213E] rounded-xl p-4 border",
                  card.border
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4" />
                  <span className="text-sm text-gray-400">{type}</span>
                </div>
                <div className="text-2xl font-bold">{annotationCounts[type]}</div>
              </div>
            )
          })}
        </div>

        <div className="overflow-x-auto rounded-lg border border-[#0D7377]/30">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#16213E] text-gray-400">
                <th className="px-3 py-2.5 text-left">路口编号</th>
                <th className="px-3 py-2.5 text-left">名称</th>
                <th className="px-3 py-2.5 text-right">距起点(m)</th>
                <th className="px-3 py-2.5 text-center">周期(s)</th>
                <th className="px-3 py-2.5 text-center">绿信比</th>
                <th className="px-3 py-2.5 text-center">偏移量(s)</th>
                <th className="px-3 py-2.5 text-center">方向</th>
                <th className="px-3 py-2.5 text-center">来源</th>
                <th className="px-3 py-2.5 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Tag className="w-3.5 h-3.5" />
                    标注
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredIntersections.map((item) => {
                const currentAnnotation = annotations[item.id] || ""
                const hasIssue = hasValidationIssue(item.id)
                const style = ANNOTATION_STYLES[currentAnnotation]

                return (
                  <tr
                    key={item.id}
                    className={cn(
                      "border-t border-[#0D7377]/10 hover:bg-[#16213E]/50",
                      hasIssue && "bg-red-950/20"
                    )}
                  >
                    <td className="px-3 py-2 font-mono">{item.id}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {item.name}
                        {hasIssue && (
                          <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">{item.distanceFromStart}</td>
                    <td className="px-3 py-2 text-center">{item.cycle}</td>
                    <td className="px-3 py-2 text-center">{item.greenRatio.toFixed(2)}</td>
                    <td className="px-3 py-2 text-center">{item.offset}</td>
                    <td className="px-3 py-2 text-center">{item.direction}</td>
                    <td className="px-3 py-2 text-center text-xs text-gray-500">
                      {item.sourceFile}:L{item.sourceRow}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <select
                        value={currentAnnotation}
                        onChange={(e) => setAnnotation(item.id, e.target.value)}
                        className={cn(
                          "px-2 py-1 rounded text-xs outline-none cursor-pointer transition-colors",
                          style
                                            ? `${style.bg} ${style.text}`
                                            : "bg-[#16213E] text-gray-500 hover:bg-[#0D7377]/20"
                                        )}
                      >
                        {ANNOTATION_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt || "未标注"}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                )
              })}
              {filteredIntersections.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-gray-500">
                    暂无路口数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {filteredIntersections.length > 0 && (
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>
              共 {filteredIntersections.length} 条路口记录，
              已标注 {filteredIntersections.filter((i) => annotations[i.id]).length} 条
            </span>
            <span>
              存在验证问题：{filteredIntersections.filter((i) => hasValidationIssue(i.id)).length} 条
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
