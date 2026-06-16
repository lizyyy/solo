import { useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { useStore } from "@/store/useStore"
import type { ManualAdjustment, IntersectionData } from "@/lib/types"
import { ArrowLeft, ArrowRight, Download, Filter, GitCompare } from "lucide-react"
import { cn } from "@/lib/utils"

type FilterType = "全部" | "上行" | "下行"

const FIELD_LABELS: Record<string, string> = {
  offset: "偏移量",
  greenRatio: "绿信比",
  cycle: "周期",
  distanceFromStart: "距起点距离",
}

const FIELD_UNITS: Record<string, string> = {
  offset: "s",
  greenRatio: "",
  cycle: "s",
  distanceFromStart: "m",
}

const DISPLAY_FIELDS = ["distanceFromStart", "cycle", "greenRatio", "offset"] as const

export default function DiffPage() {
  const navigate = useNavigate()
  const {
    intersections,
    manualAdjustments,
    activeFilter,
    setActiveFilter,
  } = useStore()

  const filteredIntersections = useMemo<IntersectionData[]>(() => {
    if (activeFilter === "全部") return intersections
    return intersections.filter((i) => i.direction === activeFilter)
  }, [intersections, activeFilter])

  const filteredAdjustments = useMemo<ManualAdjustment[]>(() => {
    const filteredIds = new Set(filteredIntersections.map((i) => i.id))
    return manualAdjustments.filter((a) => filteredIds.has(a.intersectionId))
  }, [manualAdjustments, filteredIntersections])

  const adjustedIntersectionIds = useMemo(() => {
    return new Set(filteredAdjustments.map((a) => a.intersectionId))
  }, [filteredAdjustments])

  const adjustedIntersections = useMemo(() => {
    return filteredIntersections.filter((i) => adjustedIntersectionIds.has(i.id))
  }, [filteredIntersections, adjustedIntersectionIds])

  const unadjustedIntersections = useMemo(() => {
    return filteredIntersections.filter((i) => !adjustedIntersectionIds.has(i.id))
  }, [filteredIntersections, adjustedIntersectionIds])

  const isFieldAdjusted = (intersectionId: string, field: string) =>
    filteredAdjustments.some((a) => a.intersectionId === intersectionId && a.field === field)

  const getOriginalValue = (intersectionId: string, field: string) =>
    filteredAdjustments.find((a) => a.intersectionId === intersectionId && a.field === field)?.originalValue

  const formatValue = (field: string, value: number) => {
    if (field === "greenRatio") return value.toFixed(2)
    return String(value)
  }

  const exportDiffCSV = () => {
    const header = "路口编号,字段,导入值,修正值,修改时间"
    const rows = filteredAdjustments.map((a) =>
      `${a.intersectionId},${FIELD_LABELS[a.field] || a.field},${a.originalValue},${a.adjustedValue},${a.timestamp}`
    )
    const csv = [header, ...rows].join("\n")
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `差异对比_${activeFilter}_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-[#1A1A2E] text-gray-200 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/supplement")}
              className="p-2 rounded-lg hover:bg-[#0D7377]/30 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <GitCompare className="w-6 h-6 text-[#0D7377]" />
              <h1 className="text-2xl font-bold">差异对比</h1>
            </div>
          </div>
          <button
            onClick={() => navigate("/report")}
            className="flex items-center gap-2 bg-[#0D7377] hover:bg-[#0D7377]/80 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            查看报告
          </button>
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
          {filteredAdjustments.length > 0 && (
            <button
              onClick={exportDiffCSV}
              className="flex items-center gap-2 bg-[#D4A017]/20 hover:bg-[#D4A017]/30 text-[#D4A017] px-4 py-2 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              导出差异CSV
            </button>
          )}
        </div>

        {filteredAdjustments.length === 0 ? (
          <div className="bg-[#16213E] rounded-lg p-8 text-center">
            <GitCompare className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 text-lg">暂无人工修正记录</p>
            <p className="text-gray-500 text-sm mt-2">
              前往调参页面修改路口参数后，差异将在此显示
            </p>
            <button
              onClick={() => navigate("/adjust")}
              className="mt-4 px-4 py-2 bg-[#0D7377] hover:bg-[#0D7377]/80 text-white rounded-lg transition-colors text-sm"
            >
              前往调参
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#D4A017]" />
                修正记录明细
                <span className="text-sm text-gray-400 font-normal">
                  （共 {filteredAdjustments.length} 条）
                </span>
              </h2>
              <div className="overflow-x-auto rounded-lg border border-[#0D7377]/30">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#16213E] text-gray-400">
                      <th className="px-3 py-2.5 text-left">路口编号</th>
                      <th className="px-3 py-2.5 text-left">字段</th>
                      <th className="px-3 py-2.5 text-right">导入值</th>
                      <th className="px-3 py-2.5 text-right">修正值</th>
                      <th className="px-3 py-2.5 text-right">变化量</th>
                      <th className="px-3 py-2.5 text-left">修改时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAdjustments.map((adj, idx) => {
                      const diff = adj.adjustedValue - adj.originalValue
                      return (
                        <tr
                          key={`${adj.intersectionId}-${adj.field}-${idx}`}
                          className="border-t border-[#0D7377]/10 hover:bg-[#16213E]/50"
                        >
                          <td className="px-3 py-2 font-mono text-[#0D7377]">
                            {adj.intersectionId}
                          </td>
                          <td className="px-3 py-2">
                            <span className="text-[#D4A017]">
                              {FIELD_LABELS[adj.field] || adj.field}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right text-gray-400">
                            {formatValue(adj.field, adj.originalValue)}
                            {FIELD_UNITS[adj.field] && (
                              <span className="text-gray-600 ml-0.5">{FIELD_UNITS[adj.field]}</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right text-[#D4A017] font-semibold">
                            {formatValue(adj.field, adj.adjustedValue)}
                            {FIELD_UNITS[adj.field] && (
                              <span className="text-[#D4A017]/70 ml-0.5">{FIELD_UNITS[adj.field]}</span>
                            )}
                          </td>
                          <td className={cn("px-3 py-2 text-right font-mono text-sm", diff > 0 ? "text-red-400" : diff < 0 ? "text-green-400" : "text-gray-500")}>
                            {diff > 0 ? "+" : ""}{formatValue(adj.field, diff)}
                          </td>
                          <td className="px-3 py-2 text-gray-500 text-xs">
                            {new Date(adj.timestamp).toLocaleString("zh-CN")}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#0D7377]" />
                路口参数对比
                <span className="text-sm text-gray-400 font-normal">
                  （已修正 {adjustedIntersections.length} 个路口）
                </span>
              </h2>
              <div className="overflow-x-auto rounded-lg border border-[#0D7377]/30">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#16213E] text-gray-400">
                      <th className="px-3 py-2.5 text-left">路口编号</th>
                      <th className="px-3 py-2.5 text-left">名称</th>
                      <th className="px-3 py-2.5 text-center">方向</th>
                      {DISPLAY_FIELDS.map((f) => (
                        <th key={f} className="px-3 py-2.5 text-center">
                          {FIELD_LABELS[f]}
                          {FIELD_UNITS[f] && (
                            <span className="text-gray-600 ml-0.5">({FIELD_UNITS[f]})</span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {adjustedIntersections.map((item) => (
                      <tr
                        key={item.id}
                        className="border-t border-[#D4A017]/20 hover:bg-[#16213E]/50"
                      >
                        <td className="px-3 py-2 font-mono text-[#D4A017]">{item.id}</td>
                        <td className="px-3 py-2">{item.name}</td>
                        <td className="px-3 py-2 text-center">{item.direction}</td>
                        {DISPLAY_FIELDS.map((field) => {
                          const adjusted = isFieldAdjusted(item.id, field)
                          const origVal = adjusted ? getOriginalValue(item.id, field) : undefined
                          return (
                            <td key={field} className="px-3 py-2 text-center">
                              {adjusted ? (
                                <div className="flex flex-col items-center gap-0.5">
                                  <span className="text-[#D4A017] font-semibold">
                                    {formatValue(field, item[field as keyof IntersectionData] as number)}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    原始: {formatValue(field, origVal!)}
                                  </span>
                                </div>
                              ) : (
                                <span>
                                  {formatValue(field, item[field as keyof IntersectionData] as number)}
                                </span>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                    {unadjustedIntersections.length > 0 && (
                      <>
                        <tr>
                          <td
                            colSpan={3 + DISPLAY_FIELDS.length}
                            className="px-3 py-2 bg-[#16213E]/30 text-gray-500 text-xs text-center"
                          >
                            以下路口未被修正
                          </td>
                        </tr>
                        {unadjustedIntersections.map((item) => (
                          <tr
                            key={item.id}
                            className="border-t border-[#0D7377]/10 hover:bg-[#16213E]/50 opacity-60"
                          >
                            <td className="px-3 py-2 font-mono">{item.id}</td>
                            <td className="px-3 py-2">{item.name}</td>
                            <td className="px-3 py-2 text-center">{item.direction}</td>
                            {DISPLAY_FIELDS.map((field) => (
                              <td key={field} className="px-3 py-2 text-center text-gray-400">
                                {formatValue(field, item[field as keyof IntersectionData] as number)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        <div className="flex items-center justify-between pt-4 border-t border-[#0D7377]/20">
          <button
            onClick={() => navigate("/supplement")}
            className="flex items-center gap-2 text-gray-400 hover:text-gray-200 px-4 py-2 rounded-lg hover:bg-[#16213E] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            返回补充
          </button>
          <button
            onClick={() => navigate("/report")}
            className="flex items-center gap-2 bg-[#0D7377] hover:bg-[#0D7377]/80 text-white px-4 py-2 rounded-lg transition-colors"
          >
            查看报告
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
