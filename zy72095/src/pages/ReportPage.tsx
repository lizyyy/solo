import { useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { useStore } from "@/store/useStore"
import { calculateOverallBandwidth } from "@/lib/calculator"
import {
  ArrowLeft,
  ArrowRight,
  Download,
  FileText,
  Gauge,
  AlertTriangle,
  Pencil,
  TrendingUp,
  Database,
} from "lucide-react"
import { cn } from "@/lib/utils"

const FIELD_LABELS: Record<string, string> = {
  offset: "偏移量",
  greenRatio: "绿信比",
  cycle: "周期",
  distanceFromStart: "距起点距离",
}

export default function ReportPage() {
  const navigate = useNavigate()
  const {
    intersections,
    speedBandResults,
    validationResults,
    manualAdjustments,
    optimizationSuggestions,
    commonCycle,
    direction,
    activeFilter,
  } = useStore()

  const filteredIntersections = useMemo(() => {
    if (activeFilter === "全部") return intersections
    return intersections.filter((i) => i.direction === activeFilter)
  }, [intersections, activeFilter])

  const filteredResults = useMemo(() => {
    if (activeFilter === "全部") return speedBandResults
    const names = new Set(filteredIntersections.map((i) => i.name))
    return speedBandResults.filter(
      (r) => names.has(r.fromIntersection) && names.has(r.toIntersection)
    )
  }, [speedBandResults, activeFilter, filteredIntersections])

  const speedSummary = useMemo(() => {
    const valid = filteredResults.filter((r) => !r.isAnomalous)
    if (valid.length === 0) return null
    const speeds = valid.flatMap((r) => [r.speedMin, r.speedMax]).filter((s) => s > 0)
    if (speeds.length === 0) return null
    return {
      speedMin: Math.min(...speeds),
      speedMax: Math.max(...speeds),
      avgBandwidth:
        Math.round(
          (valid.reduce((s, r) => s + r.bandwidth, 0) / valid.length) * 10
        ) / 10,
      overallBandwidth: calculateOverallBandwidth(filteredIntersections),
      validCount: valid.length,
    }
  }, [filteredResults, filteredIntersections])

  const boundaryAnomalies = validationResults.filter((r) => r.type === "boundary")
  const bandwidthAnomalies = filteredResults.filter((r) => r.isAnomalous)
  const totalAnomalies = boundaryAnomalies.length + bandwidthAnomalies.length

  const sourceSummary = useMemo(() => {
    const map = new Map<string, number>()
    for (const i of filteredIntersections) {
      map.set(i.sourceFile, (map.get(i.sourceFile) || 0) + 1)
    }
    return Array.from(map.entries()).map(([file, count]) => ({ file, count }))
  }, [filteredIntersections])

  const exportCSV = () => {
    const lines: string[] = []

    lines.push("基本信息")
    lines.push("项目,值")
    lines.push(`公共周期(s),${commonCycle}`)
    lines.push(`方向,${direction}`)
    lines.push(`路口数量,${filteredIntersections.length}`)
    lines.push(`当前筛选,${activeFilter}`)
    lines.push("")

    lines.push("速度带汇总")
    lines.push("项目,值")
    if (speedSummary) {
      lines.push(`最低速度(km/h),${speedSummary.speedMin.toFixed(1)}`)
      lines.push(`最高速度(km/h),${speedSummary.speedMax.toFixed(1)}`)
      lines.push(`平均带宽(s),${speedSummary.avgBandwidth.toFixed(1)}`)
      lines.push(`全段带宽(s),${speedSummary.overallBandwidth.toFixed(1)}`)
      lines.push(`有效路段数,${speedSummary.validCount}`)
    } else {
      lines.push("无有效数据,")
    }
    lines.push("")

    lines.push("异常汇总")
    lines.push("类型,数量")
    lines.push(`边界异常,${boundaryAnomalies.length}`)
    lines.push(`带宽异常,${bandwidthAnomalies.length}`)
    lines.push(`合计,${totalAnomalies}`)
    lines.push("")

    lines.push("人工修正明细")
    lines.push(`修正总数,${manualAdjustments.length}`)
    if (manualAdjustments.length > 0) {
      lines.push("路口编号,字段,原始值,调整值,时间")
      for (const adj of manualAdjustments) {
        const label = FIELD_LABELS[adj.field] || adj.field
        lines.push(
          `${adj.intersectionId},${label},${adj.originalValue},${adj.adjustedValue},${adj.timestamp}`
        )
      }
    }
    lines.push("")

    lines.push("优化建议明细")
    lines.push(`建议总数,${optimizationSuggestions.length}`)
    if (optimizationSuggestions.length > 0) {
      lines.push("路口编号,字段,当前值,建议值,带宽影响(s),原因")
      for (const s of optimizationSuggestions) {
        const fieldLabel = s.field === "offset" ? "偏移量" : "绿信比"
        lines.push(
          `${s.intersectionId},${fieldLabel},${s.currentValue},${s.suggestedValue},${s.impactOnBandwidth},"${s.reason}"`
        )
      }
    }
    lines.push("")

    lines.push("数据来源")
    lines.push("文件名,路口数量")
    for (const { file, count } of sourceSummary) {
      lines.push(`"${file}",${count}`)
    }

    const csv = lines.join("\n")
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `绿波报告_${activeFilter}_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-[#1A1A2E] text-gray-200 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/diff")}
              className="p-2 rounded-lg hover:bg-[#0D7377]/30 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-[#0D7377]">综合报告</h1>
              <p className="text-sm text-gray-500">道路绿波速度带计算报告</p>
            </div>
          </div>
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-[#0D7377] hover:bg-[#0D7377]/80 text-white rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            导出CSV
          </button>
        </div>

        <section className="bg-[#16213E] rounded-lg border border-[#0D7377]/30 p-5">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-[#0D7377]" />
            基本信息
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-gray-400">公共周期</div>
              <div className="text-xl font-mono font-bold text-[#0D7377] mt-1">
                {commonCycle}
                <span className="text-sm text-gray-500 ml-1">s</span>
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-400">方向</div>
              <div className="text-xl font-bold mt-1">{direction}</div>
            </div>
            <div>
              <div className="text-sm text-gray-400">路口数量</div>
              <div className="text-xl font-mono font-bold mt-1">
                {filteredIntersections.length}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-400">当前筛选</div>
              <div className="text-xl font-bold mt-1">{activeFilter}</div>
            </div>
          </div>
        </section>

        <section className="bg-[#16213E] rounded-lg border border-[#0D7377]/30 p-5">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Gauge className="w-5 h-5 text-[#0D7377]" />
            速度带汇总
          </h2>
          {speedSummary ? (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <div className="text-sm text-gray-400">最低速度</div>
                <div className="text-xl font-mono font-bold text-[#0D7377] mt-1">
                  {speedSummary.speedMin.toFixed(1)}
                  <span className="text-sm text-gray-500 ml-1">km/h</span>
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-400">最高速度</div>
                <div className="text-xl font-mono font-bold text-[#0D7377] mt-1">
                  {speedSummary.speedMax.toFixed(1)}
                  <span className="text-sm text-gray-500 ml-1">km/h</span>
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-400">平均带宽</div>
                <div className="text-xl font-mono font-bold mt-1">
                  {speedSummary.avgBandwidth.toFixed(1)}
                  <span className="text-sm text-gray-500 ml-1">s</span>
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-400">全段带宽</div>
                <div className="text-xl font-mono font-bold text-[#D4A017] mt-1">
                  {speedSummary.overallBandwidth.toFixed(1)}
                  <span className="text-sm text-gray-500 ml-1">s</span>
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-400">有效路段</div>
                <div className="text-xl font-mono font-bold mt-1">
                  {speedSummary.validCount}
                  <span className="text-sm text-gray-500 ml-1">段</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-gray-500 text-sm">暂无有效速度带数据</div>
          )}
        </section>

        <section
          className={cn(
            "bg-[#16213E] rounded-lg p-5",
            totalAnomalies > 0 ? "border border-red-500/30" : "border border-gray-700/50"
          )}
        >
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <AlertTriangle
              className={cn(
                "w-5 h-5",
                totalAnomalies > 0 ? "text-red-400" : "text-gray-500"
              )}
            />
            异常汇总
            {totalAnomalies > 0 && (
              <span className="text-sm font-normal text-gray-400">
                共 {totalAnomalies} 条
              </span>
            )}
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-gray-400">边界异常</div>
              <div className="text-xl font-mono font-bold text-orange-400 mt-1">
                {boundaryAnomalies.length}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-400">带宽异常</div>
              <div className="text-xl font-mono font-bold text-red-400 mt-1">
                {bandwidthAnomalies.length}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-400">异常总计</div>
              <div className="text-xl font-mono font-bold text-red-300 mt-1">
                {totalAnomalies}
              </div>
            </div>
          </div>
          {totalAnomalies > 0 && (
            <div className="mt-4 space-y-2">
              {boundaryAnomalies.map((a) => (
                <div key={a.id} className="flex items-start gap-2 text-sm">
                  <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-orange-300">[边界]</span> {a.message}
                  </div>
                </div>
              ))}
              {bandwidthAnomalies.map((a, i) => (
                <div key={`b-${i}`} className="flex items-start gap-2 text-sm">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-red-300">[带宽]</span>{" "}
                    {a.fromIntersection}→{a.toIntersection}: {a.anomalyReason}
                  </div>
                </div>
              ))}
            </div>
          )}
          {totalAnomalies === 0 && (
            <div className="text-gray-500 text-sm mt-2">未检测到异常</div>
          )}
        </section>

        <section className="bg-[#16213E] rounded-lg border border-[#D4A017]/30 p-5">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Pencil className="w-5 h-5 text-[#D4A017]" />
            人工修正汇总
            <span className="text-sm font-normal text-gray-400">
              共 {manualAdjustments.length} 条
            </span>
          </h2>
          {manualAdjustments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-700">
                    <th className="px-3 py-2 text-left">路口编号</th>
                    <th className="px-3 py-2 text-left">字段</th>
                    <th className="px-3 py-2 text-right">原始值</th>
                    <th className="px-3 py-2 text-right">调整值</th>
                    <th className="px-3 py-2 text-left">时间</th>
                  </tr>
                </thead>
                <tbody>
                  {manualAdjustments.map((adj, i) => (
                    <tr key={i} className="border-t border-gray-700/50">
                      <td className="px-3 py-2 font-mono">{adj.intersectionId}</td>
                      <td className="px-3 py-2">
                        {FIELD_LABELS[adj.field] || adj.field}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-400">
                        {adj.originalValue}
                      </td>
                      <td className="px-3 py-2 text-right text-[#D4A017] font-semibold">
                        {adj.adjustedValue}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500">
                        {adj.timestamp}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-gray-500 text-sm">暂无人工修正记录</div>
          )}
        </section>

        <section className="bg-[#16213E] rounded-lg border border-green-500/30 p-5">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-green-400" />
            优化建议汇总
            <span className="text-sm font-normal text-gray-400">
              共 {optimizationSuggestions.length} 条
            </span>
          </h2>
          {optimizationSuggestions.length > 0 ? (
            <div className="space-y-3">
              {optimizationSuggestions.map((s, i) => (
                <div key={i} className="bg-[#1A1A2E] rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="font-mono text-green-400">
                        {s.intersectionId}
                      </span>
                      <span className="text-gray-400 mx-2">
                        {s.intersectionName}
                      </span>
                      <span className="text-sm">
                        {s.field === "offset" ? "偏移量" : "绿信比"}:{" "}
                      </span>
                      <span className="text-gray-300">{s.currentValue}</span>
                      <span className="text-gray-500 mx-1">→</span>
                      <span className="text-green-400 font-semibold">
                        {s.suggestedValue}
                      </span>
                    </div>
                    <span className="text-green-400 text-sm font-mono">
                      +{s.impactOnBandwidth}s 带宽
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 leading-relaxed">{s.reason}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-500 text-sm">暂无优化建议</div>
          )}
        </section>

        <section className="bg-[#16213E] rounded-lg border border-gray-700/50 p-5">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Database className="w-5 h-5 text-gray-400" />
            数据来源
          </h2>
          {sourceSummary.length > 0 ? (
            <div className="space-y-2">
              {sourceSummary.map(({ file, count }) => (
                <div
                  key={file}
                  className="flex items-center justify-between bg-[#1A1A2E] rounded-lg px-4 py-2"
                >
                  <span className="text-sm font-mono">{file}</span>
                  <span className="text-sm text-[#0D7377] font-semibold">
                    {count} 条路口
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-500 text-sm">暂无数据来源</div>
          )}
        </section>

        <div className="flex justify-between pt-4">
          <button
            onClick={() => navigate("/diff")}
            className="flex items-center gap-2 px-4 py-2 border border-gray-600 rounded-lg text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            返回对比
          </button>
          <button
            onClick={() => navigate("/adjust")}
            className="flex items-center gap-2 px-6 py-2.5 bg-[#D4A017] text-[#1A1A2E] rounded-lg font-semibold hover:bg-[#D4A017]/80 transition-colors"
          >
            继续调参
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
