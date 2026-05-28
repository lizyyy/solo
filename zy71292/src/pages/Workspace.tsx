import { useEffect, useRef, useState, useMemo, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import * as d3 from "d3"
import {
  Settings2,
  Play,
  ChevronDown,
  ChevronUp,
  X,
  FileText,
  AlertTriangle,
  Info,
  AlertCircle,
  Network,
  Layers,
  Sliders,
} from "lucide-react"
import { useAppStore } from "@/store"
import { runCommunityDetection } from "@/algorithms"
import {
  GROUP_COLORS,
  SEVERITY_CONFIG,
  CONFLICT_TYPE_LABELS,
  type Conflict,
} from "@/types"
import { cn } from "@/lib/utils"

interface D3Node extends d3.SimulationNodeDatum {
  id: string
  name: string
  groupIndex: number
  isConflict: boolean
}

interface D3Link extends d3.SimulationLinkDatum<D3Node> {
  id: string
  weight: number
}

export default function Workspace() {
  const navigate = useNavigate()
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const simulationRef = useRef<d3.Simulation<D3Node, D3Link> | null>(null)

  const nodes = useAppStore((s) => s.nodes)
  const edges = useAppStore((s) => s.edges)
  const blacklist = useAppStore((s) => s.blacklist)
  const projectLabels = useAppStore((s) => s.projectLabels)
  const capacityConfig = useAppStore((s) => s.capacityConfig)
  const algorithmConfig = useAppStore((s) => s.algorithmConfig)
  const groups = useAppStore((s) => s.groups)
  const conflicts = useAppStore((s) => s.conflicts)
  const setAlgorithmConfig = useAppStore((s) => s.setAlgorithmConfig)
  const setGroups = useAppStore((s) => s.setGroups)
  const setConflicts = useAppStore((s) => s.setConflicts)
  const setRunning = useAppStore((s) => s.setRunning)
  const isRunning = useAppStore((s) => s.isRunning)

  const [drawerOpen, setDrawerOpen] = useState(true)
  const [panelOpen, setPanelOpen] = useState(true)
  const [selectedConflict, setSelectedConflict] = useState<Conflict | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })
  const [expandedConflicts, setExpandedConflicts] = useState<Set<string>>(new Set())

  const nodeGroupMap = useMemo(() => {
    const map: Record<string, number> = {}
    groups.forEach((group, idx) => {
      group.memberIds.forEach((id) => {
        map[id] = idx % GROUP_COLORS.length
      })
    })
    return map
  }, [groups])

  const conflictNodeIds = useMemo(() => {
    const set = new Set<string>()
    conflicts.forEach((c) => {
      c.affectedNodeIds.forEach((id) => set.add(id))
    })
    return set
  }, [conflicts])

  const d3Data = useMemo(() => {
    const d3Nodes: D3Node[] = nodes.map((n) => ({
      id: n.id,
      name: n.name,
      groupIndex: nodeGroupMap[n.id] ?? 0,
      isConflict: conflictNodeIds.has(n.id),
    }))

    const nodeMap = new Map(d3Nodes.map((n) => [n.id, n]))
    const d3Links: D3Link[] = edges.map((e) => ({
      id: e.id,
      source: nodeMap.get(e.source)!,
      target: nodeMap.get(e.target)!,
      weight: e.weight,
    }))

    return { nodes: d3Nodes, links: d3Links }
  }, [nodes, edges, nodeGroupMap, conflictNodeIds])

  const handleRunAlgorithm = useCallback(() => {
    setRunning(true)
    setTimeout(() => {
      const result = runCommunityDetection(
        nodes,
        edges,
        blacklist,
        capacityConfig,
        algorithmConfig,
        projectLabels
      )
      setGroups(result.groups)
      setConflicts(result.conflicts)
      setRunning(false)
    }, 500)
  }, [
    nodes,
    edges,
    blacklist,
    capacityConfig,
    algorithmConfig,
    projectLabels,
    setRunning,
    setGroups,
    setConflicts,
  ])

  const toggleConflict = (id: string) => {
    setExpandedConflicts((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const showConflictTooltip = (conflict: Conflict, event: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (rect) {
      setTooltipPosition({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      })
    }
    setSelectedConflict(conflict)
  }

  const groupedConflicts = useMemo(() => {
    return {
      fatal: conflicts.filter((c) => c.severity === "fatal"),
      warning: conflicts.filter((c) => c.severity === "warning"),
      info: conflicts.filter((c) => c.severity === "info"),
    }
  }, [conflicts])

  useEffect(() => {
    if (!svgRef.current || d3Data.nodes.length === 0) return

    const svg = d3.select(svgRef.current)
    const width = svgRef.current.clientWidth
    const height = svgRef.current.clientHeight

    svg.selectAll("*").remove()

    const defs = svg.append("defs")
    defs
      .append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "-0 -5 10 10")
      .attr("refX", 25)
      .attr("refY", 0)
      .attr("orient", "auto")
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .append("path")
      .attr("d", "M 0,-5 L 10,0 L 0,5")
      .attr("fill", "rgba(148, 163, 184, 0.4)")

    const g = svg.append("g")

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform)
      })

    svg.call(zoom)

    const link = g
      .append("g")
      .selectAll("line")
      .data(d3Data.links)
      .enter()
      .append("line")
      .attr("stroke", "rgba(148, 163, 184, 0.3)")
      .attr("stroke-width", (d) => Math.max(1, d.weight * 2))
      .attr("stroke-opacity", 0.6)

    const nodeGroup = g
      .append("g")
      .selectAll("g")
      .data(d3Data.nodes)
      .enter()
      .append("g")
      .attr("cursor", "grab")

    nodeGroup
      .append("circle")
      .attr("r", (d) => (d.isConflict ? 18 : 14))
      .attr("fill", (d) => GROUP_COLORS[d.groupIndex])
      .attr("stroke", (d) => (d.isConflict ? "#ef4444" : "rgba(255,255,255,0.3)"))
      .attr("stroke-width", (d) => (d.isConflict ? 3 : 2))
      .style("filter", (d) =>
        d.isConflict
          ? "drop-shadow(0 0 8px rgba(239, 68, 68, 0.6))"
          : "drop-shadow(0 2px 4px rgba(0,0,0,0.3))"
      )

    nodeGroup
      .append("text")
      .text((d) => d.name)
      .attr("text-anchor", "middle")
      .attr("dy", 28)
      .attr("fill", "rgba(255,255,255,0.8)")
      .attr("font-size", "11px")
      .attr("font-weight", "500")
      .attr("pointer-events", "none")

    const pulseCircle = nodeGroup
      .filter((d) => d.isConflict)
      .append("circle")
      .attr("r", 18)
      .attr("fill", "none")
      .attr("stroke", "#ef4444")
      .attr("stroke-width", 2)
      .attr("opacity", 0)

    const pulse = () => {
      pulseCircle
        .attr("opacity", 1)
        .attr("r", 18)
        .transition()
        .duration(1500)
        .ease(d3.easeQuadOut)
        .attr("r", 32)
        .attr("opacity", 0)
        .on("end", pulse)
    }
    pulse()

    const drag = d3
      .drag<SVGGElement, D3Node, D3Node>()
      .on("start", (event, d) => {
        if (!event.active && simulationRef.current) {
          simulationRef.current.alphaTarget(0.3).restart()
        }
        d.fx = d.x
        d.fy = d.y
      })
      .on("drag", (event, d) => {
        d.fx = event.x
        d.fy = event.y
      })
      .on("end", (event, d) => {
        if (!event.active && simulationRef.current) {
          simulationRef.current.alphaTarget(0)
        }
        d.fx = null
        d.fy = null
      })

    nodeGroup.call(drag)

    const simulation = d3
      .forceSimulation(d3Data.nodes)
      .force(
        "link",
        d3
          .forceLink<D3Node, D3Link>(d3Data.links)
          .id((d) => d.id)
          .distance((d) => 80 + (1 - d.weight) * 60)
      )
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(30))
      .on("tick", () => {
        link
          .attr("x1", (d) => (d.source as D3Node).x!)
          .attr("y1", (d) => (d.source as D3Node).y!)
          .attr("x2", (d) => (d.target as D3Node).x!)
          .attr("y2", (d) => (d.target as D3Node).y!)

        nodeGroup.attr("transform", (d) => `translate(${d.x},${d.y})`)
      })

    simulationRef.current = simulation

    return () => {
      simulation.stop()
    }
  }, [d3Data])

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-slate-950 overflow-hidden"
    >
      <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-900/80 backdrop-blur-sm rounded-lg border border-slate-700/50">
            <Network className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-slate-300">节点数: {nodes.length}</span>
            <span className="text-slate-600">|</span>
            <Layers className="w-4 h-4 text-emerald-400" />
            <span className="text-sm text-slate-300">边数: {edges.length}</span>
            {groups.length > 0 && (
              <>
                <span className="text-slate-600">|</span>
                <span className="text-sm text-slate-300">分组: {groups.length}</span>
              </>
            )}
            {conflicts.length > 0 && (
              <>
                <span className="text-slate-600">|</span>
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span className="text-sm text-slate-300">冲突: {conflicts.length}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setDrawerOpen(!drawerOpen)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg border transition-all",
              drawerOpen
                ? "bg-blue-500/20 border-blue-500/50 text-blue-300"
                : "bg-slate-900/80 border-slate-700/50 text-slate-300 hover:bg-slate-800"
            )}
          >
            <Sliders className="w-4 h-4" />
            <span className="text-sm">算法控制台</span>
          </button>
          <button
            onClick={() => navigate("/report")}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
          >
            <FileText className="w-4 h-4" />
            <span className="text-sm">生成报告</span>
          </button>
        </div>
      </div>

      <svg
        ref={svgRef}
        className="w-full h-full"
        style={{ background: "radial-gradient(ellipse at center, #0f172a 0%, #020617 100%)" }}
      />

      <div
        className={cn(
          "absolute top-0 right-0 h-full w-80 bg-slate-900/95 backdrop-blur-md border-l border-slate-700/50 transform transition-transform duration-300 ease-out z-30",
          drawerOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="p-5 border-b border-slate-700/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-blue-400" />
            <h2 className="text-base font-semibold text-white">社区发现控制台</h2>
          </div>
          <button
            onClick={() => setDrawerOpen(false)}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-6 pb-24">
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-300">算法选择</label>
            <div className="grid grid-cols-2 gap-2">
              {(["louvain", "label_propagation"] as const).map((algo) => (
                <button
                  key={algo}
                  onClick={() =>
                    setAlgorithmConfig({ ...algorithmConfig, algorithm: algo })
                  }
                  className={cn(
                    "px-3 py-2.5 rounded-lg border text-sm font-medium transition-all",
                    algorithmConfig.algorithm === algo
                      ? "bg-blue-500/20 border-blue-500/50 text-blue-300"
                      : "bg-slate-800/50 border-slate-700/50 text-slate-400 hover:border-slate-600"
                  )}
                >
                  {algo === "louvain" ? "Louvain" : "标签传播"}
                </button>
              ))}
            </div>
          </div>

          {algorithmConfig.algorithm === "louvain" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-300">
                  Resolution 参数
                </label>
                <span className="text-sm text-blue-400 font-mono">
                  {algorithmConfig.resolution.toFixed(1)}
                </span>
              </div>
              <input
                type="range"
                min="0.1"
                max="2.0"
                step="0.1"
                value={algorithmConfig.resolution}
                onChange={(e) =>
                  setAlgorithmConfig({
                    ...algorithmConfig,
                    resolution: parseFloat(e.target.value),
                  })
                }
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <p className="text-xs text-slate-500">
                较小值产生更少社区，较大值产生更多社区
              </p>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-300">强关系阈值</label>
              <span className="text-sm text-emerald-400 font-mono">
                {algorithmConfig.strongRelationThreshold.toFixed(1)}
              </span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.1"
              value={algorithmConfig.strongRelationThreshold}
              onChange={(e) =>
                setAlgorithmConfig({
                  ...algorithmConfig,
                  strongRelationThreshold: parseFloat(e.target.value),
                })
              }
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            <p className="text-xs text-slate-500">
              权重超过该值的关系被视为强关系，不应被拆分
            </p>
          </div>

          <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700/50 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">容量配置</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">最小分组大小</span>
              <span className="text-slate-300 font-mono">
                {capacityConfig.minSize}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">最大分组大小</span>
              <span className="text-slate-300 font-mono">
                {capacityConfig.maxSize}
              </span>
            </div>
          </div>

          <button
            onClick={handleRunAlgorithm}
            disabled={isRunning || nodes.length === 0}
            className={cn(
              "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all",
              isRunning || nodes.length === 0
                ? "bg-slate-700 text-slate-500 cursor-not-allowed"
                : "bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-lg shadow-blue-500/25"
            )}
          >
            <Play className={cn("w-4 h-4", isRunning && "animate-pulse")} />
            <span>{isRunning ? "执行中..." : "执行社区发现"}</span>
          </button>
        </div>
      </div>

      <div
        className={cn(
          "absolute left-0 right-0 bottom-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-700/50 transform transition-all duration-300 ease-out z-20",
          panelOpen ? "translate-y-0" : "translate-y-[calc(100%-48px)]"
        )}
        style={{ maxHeight: "45%" }}
      >
        <div
          className="h-12 px-5 flex items-center justify-between border-b border-slate-700/50 cursor-pointer"
          onClick={() => setPanelOpen(!panelOpen)}
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-medium text-white">约束校验面板</span>
            <div className="flex items-center gap-2">
              {groupedConflicts.fatal.length > 0 && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  致命 {groupedConflicts.fatal.length}
                </span>
              )}
              {groupedConflicts.warning.length > 0 && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  警告 {groupedConflicts.warning.length}
                </span>
              )}
              {groupedConflicts.info.length > 0 && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  提示 {groupedConflicts.info.length}
                </span>
              )}
            </div>
          </div>
          <button className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors">
            {panelOpen ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronUp className="w-4 h-4" />
            )}
          </button>
        </div>

        <div className="p-4 overflow-y-auto" style={{ maxHeight: "calc(100% - 48px)" }}>
          {conflicts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-500">
              <Info className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">暂无冲突检测结果</p>
              <p className="text-xs mt-1">执行社区发现算法后将自动检测约束冲突</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {conflicts.map((conflict) => {
                const severityConfig = SEVERITY_CONFIG[conflict.severity]
                const isExpanded = expandedConflicts.has(conflict.id)

                return (
                  <div
                    key={conflict.id}
                    className={cn(
                      "rounded-lg border transition-all cursor-pointer",
                      "hover:scale-[1.02] hover:shadow-lg",
                      isExpanded && "ring-2 ring-offset-2 ring-offset-slate-900"
                    )}
                    style={{
                      backgroundColor: severityConfig.bgColor,
                      borderColor: isExpanded ? severityConfig.color : severityConfig.borderColor,
                      boxShadow: isExpanded
                        ? `0 0 20px ${severityConfig.color}40`
                        : "none",
                    }}
                    onClick={(e) => {
                      toggleConflict(conflict.id)
                      showConflictTooltip(conflict, e)
                    }}
                  >
                    <div className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {conflict.severity === "fatal" && (
                            <AlertCircle
                              className="w-4 h-4 flex-shrink-0"
                              style={{ color: severityConfig.color }}
                            />
                          )}
                          {conflict.severity === "warning" && (
                            <AlertTriangle
                              className="w-4 h-4 flex-shrink-0"
                              style={{ color: severityConfig.color }}
                            />
                          )}
                          {conflict.severity === "info" && (
                            <Info
                              className="w-4 h-4 flex-shrink-0"
                              style={{ color: severityConfig.color }}
                            />
                          )}
                          <span
                            className="text-sm font-medium"
                            style={{ color: severityConfig.color }}
                          >
                            {CONFLICT_TYPE_LABELS[conflict.type]}
                          </span>
                        </div>
                        <span
                          className="px-1.5 py-0.5 text-xs rounded font-medium flex-shrink-0"
                          style={{
                            backgroundColor: `${severityConfig.color}30`,
                            color: severityConfig.color,
                          }}
                        >
                          {severityConfig.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-2 line-clamp-2">
                        {conflict.description}
                      </p>
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-slate-700/50 space-y-2">
                          <div>
                            <span className="text-xs text-slate-500">涉及节点: </span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {conflict.affectedNodeIds.map((id) => {
                                const node = nodes.find((n) => n.id === id)
                                const groupIdx = nodeGroupMap[id]
                                return (
                                  <span
                                    key={id}
                                    className="px-2 py-0.5 text-xs rounded-full text-white"
                                    style={{
                                      backgroundColor:
                                        GROUP_COLORS[groupIdx] + "80",
                                    }}
                                  >
                                    {node?.name || id}
                                  </span>
                                )
                              })}
                            </div>
                          </div>
                          <div>
                            <span className="text-xs text-slate-500">建议操作: </span>
                            <p className="text-xs text-slate-300 mt-1">
                              {conflict.suggestion}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {selectedConflict && (
        <div
          className="fixed z-50 w-80 bg-slate-900 rounded-xl border border-slate-700 shadow-2xl overflow-hidden"
          style={{
            left: Math.min(tooltipPosition.x + 10, window.innerWidth - 340),
            top: Math.min(tooltipPosition.y - 100, window.innerHeight - 300),
          }}
        >
          <div
            className="p-4 border-b border-slate-700/50"
            style={{
              backgroundColor:
                SEVERITY_CONFIG[selectedConflict.severity].bgColor,
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {selectedConflict.severity === "fatal" && (
                  <AlertCircle
                    className="w-5 h-5"
                    style={{
                      color: SEVERITY_CONFIG[selectedConflict.severity].color,
                    }}
                  />
                )}
                {selectedConflict.severity === "warning" && (
                  <AlertTriangle
                    className="w-5 h-5"
                    style={{
                      color: SEVERITY_CONFIG[selectedConflict.severity].color,
                    }}
                  />
                )}
                {selectedConflict.severity === "info" && (
                  <Info
                    className="w-5 h-5"
                    style={{
                      color: SEVERITY_CONFIG[selectedConflict.severity].color,
                    }}
                  />
                )}
                <span className="font-semibold text-white">
                  {CONFLICT_TYPE_LABELS[selectedConflict.type]}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="px-2 py-0.5 text-xs rounded font-medium"
                  style={{
                    backgroundColor:
                      SEVERITY_CONFIG[selectedConflict.severity].color +
                      "30",
                    color: SEVERITY_CONFIG[selectedConflict.severity].color,
                  }}
                >
                  {SEVERITY_CONFIG[selectedConflict.severity].label}
                </span>
                <button
                  onClick={() => setSelectedConflict(null)}
                  className="p-1 rounded hover:bg-slate-800 text-slate-400 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                冲突描述
              </h4>
              <p className="text-sm text-slate-300">
                {selectedConflict.description}
              </p>
            </div>
            <div>
              <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                涉及节点 ({selectedConflict.affectedNodeIds.length})
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {selectedConflict.affectedNodeIds.map((id) => {
                  const node = nodes.find((n) => n.id === id)
                  const groupIdx = nodeGroupMap[id]
                  return (
                    <span
                      key={id}
                      className="px-2.5 py-1 text-xs rounded-full text-white font-medium"
                      style={{
                        backgroundColor: GROUP_COLORS[groupIdx] + "90",
                      }}
                    >
                      {node?.name || id}
                    </span>
                  )
                })}
              </div>
            </div>
            <div>
              <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                建议操作
              </h4>
              <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
                <p className="text-sm text-slate-300">
                  {selectedConflict.suggestion}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedConflict && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setSelectedConflict(null)}
        />
      )}
    </div>
  )
}
