import { useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { useStore } from "@/store/useStore"
import { calculateSpeedBand, calculateOptimizations, calculateOverallBandwidth } from "@/lib/calculator"
import TimeDistanceChart from "@/components/TimeDistanceChart"
import { ChevronDown, ChevronRight, ArrowLeft, ArrowRight, AlertTriangle, TrendingUp, ToggleLeft, ToggleRight } from "lucide-react"
import { cn } from "@/lib/utils"

export default function CalculatePage() {
  const navigate = useNavigate()
  const {
    intersections,
    validationResults,
    speedBandResults,
    optimizationSuggestions,
    commonCycle,
    direction,
    anomaliesIncluded,
    setSpeedBandResults,
    setOptimizationSuggestions,
    setCommonCycle,
    setDirection,
    setAnomaliesIncluded,
  } = useStore()

  const [expandedSuggestions, setExpandedSuggestions] = useState<Set<number>>(new Set())

  const handleCalculate = () => {
    const filtered = intersections.filter((i) => i.direction === direction)
    const results = calculateSpeedBand(filtered)
    const suggestions = calculateOptimizations(filtered, results)
    setSpeedBandResults(results)
    setOptimizationSuggestions(suggestions)
  }

  const toggleSuggestion = (idx: number) => {
    setExpandedSuggestions((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  const boundaryAnomalies = validationResults.filter((r) => r.type === "boundary")
  const bandwidthAnomalies = speedBandResults.filter((r) => r.isAnomalous)
  const allAnomalies = [...boundaryAnomalies, ...bandwidthAnomalies.map((r, i) => ({ id: `band-${i}`, type: "bandwidth" as const, message: `${r.fromIntersection}→${r.toIntersection}: ${r.anomalyReason}` }))]

  const summary = useMemo(() => {
    const validResults = anomaliesIncluded ? speedBandResults : speedBandResults.filter((r) => !r.isAnomalous)
    if (validResults.length === 0) return null
    const speeds = validResults.flatMap((r) => [r.speedMin, r.speedMax]).filter((s) => s > 0)
    if (speeds.length === 0) return null
    return {
      speedMin: Math.min(...speeds),
      speedMax: Math.max(...speeds),
      avgBandwidth: Math.round(validResults.reduce((s, r) => s + r.bandwidth, 0) / validResults.length * 10) / 10,
      overallBandwidth: calculateOverallBandwidth(intersections.filter((i) => i.direction === direction)),
      count: validResults.length,
    }
  }, [speedBandResults, anomaliesIncluded, intersections, direction])

  return (
    <div className="min-h-screen bg-[#1A1A2E] text-gray-200 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/import")} className="p-2 rounded-lg hover:bg-[#0D7377]/30 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-[#0D7377]">计算结果</h1>
            <p className="text-sm text-gray-500">绿波速度带分析</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 bg-[#16213E] p-4 rounded-lg">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400">公共周期</label>
            <input
              type="number"
              value={commonCycle}
              onChange={(e) => setCommonCycle(parseInt(e.target.value) || 120)}
              className="w-20 bg-[#1A1A2E] border border-gray-700 rounded px-2 py-1 text-center font-mono focus:outline-none focus:border-[#0D7377]"
            />
            <span className="text-sm text-gray-500">s</span>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400">方向</label>
            <div className="flex bg-[#1A1A2E] rounded overflow-hidden">
              {(["上行", "下行"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDirection(d)}
                  className={cn("px-3 py-1 text-sm transition-colors", direction === d ? "bg-[#0D7377] text-white" : "text-gray-400")}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleCalculate}
            disabled={intersections.length === 0}
            className="px-5 py-2 bg-[#0D7377] text-white rounded-lg hover:bg-[#0D7377]/80 disabled:opacity-40 transition-colors font-medium"
          >
            开始计算
          </button>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-sm text-gray-400">异常记录纳入汇总</span>
            <button onClick={() => setAnomaliesIncluded(!anomaliesIncluded)}>
              {anomaliesIncluded ? (
                <ToggleRight className="w-6 h-6 text-[#0D7377]" />
              ) : (
                <ToggleLeft className="w-6 h-6 text-gray-500" />
              )}
            </button>
          </div>
        </div>

        {speedBandResults.length > 0 && summary && (
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-[#16213E] rounded-lg p-4 border border-[#0D7377]/30">
              <div className="text-sm text-gray-400">综合速度范围</div>
              <div className="text-2xl font-mono font-bold text-[#0D7377] mt-1">
                {summary.speedMin.toFixed(1)} ~ {summary.speedMax.toFixed(1)}
                <span className="text-base font-normal text-gray-400 ml-1">km/h</span>
              </div>
            </div>
            <div className="bg-[#16213E] rounded-lg p-4 border border-[#D4A017]/30">
              <div className="text-sm text-gray-400">全段带宽</div>
              <div className="text-2xl font-mono font-bold text-[#D4A017] mt-1">
                {summary.overallBandwidth.toFixed(1)}
                <span className="text-base font-normal text-gray-400 ml-1">s</span>
              </div>
            </div>
            <div className="bg-[#16213E] rounded-lg p-4 border border-gray-700/50">
              <div className="text-sm text-gray-400">平均带宽</div>
              <div className="text-2xl font-mono font-bold text-gray-200 mt-1">
                {summary.avgBandwidth.toFixed(1)}
                <span className="text-base font-normal text-gray-400 ml-1">s</span>
              </div>
            </div>
            <div className="bg-[#16213E] rounded-lg p-4 border border-gray-700/50">
              <div className="text-sm text-gray-400">有效路段</div>
              <div className="text-2xl font-mono font-bold text-gray-200 mt-1">
                {summary.count}
                <span className="text-base font-normal text-gray-400 ml-1">段</span>
              </div>
            </div>
          </div>
        )}

        {speedBandResults.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#0D7377]" />
              速度带详情
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {speedBandResults.map((result) => (
                <div
                  key={result.segmentIndex}
                  className={cn(
                    "rounded-lg p-4 border",
                    result.isAnomalous
                      ? "bg-red-900/10 border-red-500/40"
                      : "bg-[#16213E] border-[#0D7377]/30"
                  )}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-400">
                      路段 {result.segmentIndex + 1}
                    </span>
                    {result.isAnomalous && (
                      <span className="text-xs text-red-400 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        异常
                      </span>
                    )}
                  </div>
                  <div className="text-lg font-semibold mb-2">
                    {result.fromIntersection} → {result.toIntersection}
                  </div>
                  <div className="flex items-baseline gap-3">
                    {result.isAnomalous ? (
                      <span className="text-red-400 text-sm">{result.anomalyReason}</span>
                    ) : (
                      <>
                        <div>
                          <span className="font-mono text-2xl font-bold text-[#0D7377]">
                            {result.speedMin.toFixed(1)}
                          </span>
                          <span className="text-gray-500 mx-1">~</span>
                          <span className="font-mono text-2xl font-bold text-[#0D7377]">
                            {result.speedMax.toFixed(1)}
                          </span>
                          <span className="text-sm text-gray-500 ml-1">km/h</span>
                        </div>
                        <div className="text-sm text-gray-400">
                          带宽 <span className="text-[#D4A017] font-mono font-semibold">{result.bandwidth}s</span>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    距离 {result.distance}m
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {speedBandResults.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">时距图</h2>
            <div className="bg-[#16213E] rounded-lg p-4 border border-[#0D7377]/30">
              <TimeDistanceChart
                intersections={intersections.filter((i) => i.direction === direction)}
                results={speedBandResults}
                cycle={commonCycle}
                anomaliesIncluded={anomaliesIncluded}
              />
            </div>
          </div>
        )}

        {optimizationSuggestions.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-400" />
              优化建议
            </h2>
            <div className="space-y-3">
              {optimizationSuggestions.map((s, idx) => (
                <div
                  key={idx}
                  className="bg-[#16213E] rounded-lg border border-green-500/30 overflow-hidden"
                >
                  <button
                    onClick={() => toggleSuggestion(idx)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-green-900/10 transition-colors text-left"
                  >
                    {expandedSuggestions.has(idx) ? (
                      <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                    )}
                    <div className="flex-1">
                      <span className="font-mono text-green-400">{s.intersectionId}</span>
                      <span className="text-gray-400 mx-2">{s.intersectionName}</span>
                      <span className="text-sm">
                        {s.field === "offset" ? "偏移量" : "绿信比"}:{" "}
                        <span className="text-gray-300">{s.currentValue}</span>
                        <span className="text-gray-500 mx-1">→</span>
                        <span className="text-green-400 font-semibold">{s.suggestedValue}</span>
                      </span>
                    </div>
                    <span className="text-green-400 text-sm font-mono">
                      +{s.impactOnBandwidth}s 带宽
                    </span>
                  </button>
                  {expandedSuggestions.has(idx) && (
                    <div className="px-4 pb-3 pt-0 ml-7">
                      <p className="text-sm text-gray-400 leading-relaxed">{s.reason}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {allAnomalies.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              异常记录
              <span className="text-sm font-normal text-gray-400">（共 {allAnomalies.length} 条）</span>
            </h2>
            <div className="bg-red-900/10 rounded-lg border border-red-500/30 p-4">
              <div className="space-y-2">
                {boundaryAnomalies.map((a) => (
                  <div key={a.id} className="flex items-start gap-2 text-sm">
                    <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-orange-300">[边界异常]</span> {a.message}
                      <p className="text-xs text-gray-500 mt-0.5">影响：可能导致绿波带宽为0</p>
                    </div>
                  </div>
                ))}
                {bandwidthAnomalies.map((a, i) => (
                  <div key={`b-${i}`} className="flex items-start gap-2 text-sm">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-red-300">[带宽异常]</span> {a.fromIntersection}→{a.toIntersection}: {a.anomalyReason}
                      <p className="text-xs text-gray-500 mt-0.5">影响：该路段不计入有效绿波</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {intersections.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            请先在导入页加载参数数据
          </div>
        )}

        {speedBandResults.length > 0 && (
          <div className="flex justify-end pt-4">
            <button
              onClick={() => navigate("/adjust")}
              className="flex items-center gap-2 px-6 py-2.5 bg-[#D4A017] text-[#1A1A2E] rounded-lg font-semibold hover:bg-[#D4A017]/80 transition-colors"
            >
              调参与重算
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
