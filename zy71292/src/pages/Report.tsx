import { useState, useMemo, useRef } from "react"
import {
  ChevronDown,
  ChevronRight,
  Download,
  Save,
  Users,
  AlertTriangle,
  Filter,
  CheckCircle,
  Clock,
  XCircle,
  Image as ImageIcon,
  FileCode,
  FileJson,
} from "lucide-react"
import { useAppStore } from "@/store"
import {
  STATUS_CONFIG,
  SEVERITY_CONFIG,
  CONFLICT_TYPE_LABELS,
  GROUP_COLORS,
} from "@/types"
import type { RecordStatus, ConflictSeverity, ConflictType, HistoryRecord } from "@/types"
import { exportAsPNG, exportAsSVG, exportAsJSON } from "@/utils/export"
import { saveHistory } from "@/utils/history"
import { cn } from "@/lib/utils"

export default function Report() {
  const groups = useAppStore((s) => s.groups)
  const conflicts = useAppStore((s) => s.conflicts)
  const nodes = useAppStore((s) => s.nodes)
  const edges = useAppStore((s) => s.edges)
  const blacklist = useAppStore((s) => s.blacklist)
  const projectLabels = useAppStore((s) => s.projectLabels)
  const capacityConfig = useAppStore((s) => s.capacityConfig)
  const algorithmConfig = useAppStore((s) => s.algorithmConfig)
  const updateGroupStatus = useAppStore((s) => s.updateGroupStatus)
  const addHistory = useAppStore((s) => s.addHistory)

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [severityFilter, setSeverityFilter] = useState<ConflictSeverity | "all">("all")
  const [typeFilter, setTypeFilter] = useState<ConflictType | "all">("all")
  const reportRef = useRef<HTMLDivElement>(null)

  const nodeMap = useMemo(() => {
    const map = new Map<string, typeof nodes[0]>()
    nodes.forEach((n) => map.set(n.id, n))
    return map
  }, [nodes])

  const getNodeName = (nodeId: string) => nodeMap.get(nodeId)?.name ?? nodeId

  const filteredConflicts = useMemo(() => {
    return conflicts.filter((c) => {
      if (severityFilter !== "all" && c.severity !== severityFilter) return false
      if (typeFilter !== "all" && c.type !== typeFilter) return false
      return true
    })
  }, [conflicts, severityFilter, typeFilter])

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
  }

  const handleStatusChange = (groupId: string, status: RecordStatus) => {
    updateGroupStatus(groupId, status)
  }

  const getGroupColor = (index: number) => GROUP_COLORS[index % GROUP_COLORS.length]

  const getConflictCountForGroup = (groupId: string) => {
    return conflicts.filter((c) => c.affectedGroupIds.includes(groupId)).length
  }

  const handleExportPNG = () => {
    const svgElement = reportRef.current?.querySelector("svg")
    if (svgElement) {
      exportAsPNG(svgElement, `分组报告-${Date.now()}.png`)
    }
  }

  const handleExportSVG = () => {
    const svgElement = reportRef.current?.querySelector("svg")
    if (svgElement) {
      exportAsSVG(svgElement, `分组报告-${Date.now()}.svg`)
    }
  }

  const handleExportJSON = () => {
    const data = {
      groups,
      conflicts,
      nodes,
      capacityConfig,
      algorithmConfig,
      exportedAt: new Date().toISOString(),
    }
    exportAsJSON(data, `分组报告-${Date.now()}.json`)
  }

  const handleSaveHistory = async () => {
    const snapshot = JSON.stringify({
      groups,
      conflicts,
      nodes,
      edges,
      blacklist,
      projectLabels,
      capacityConfig,
      algorithmConfig,
    })

    const record: HistoryRecord = {
      id: `history-${Date.now()}`,
      timestamp: new Date().toISOString(),
      snapshot,
      algorithm: algorithmConfig.algorithm,
      config: capacityConfig,
      groupCount: groups.length,
      conflictCount: conflicts.length,
    }

    try {
      await saveHistory(record)
      addHistory(record)
    } catch (e) {
      console.error("保存历史失败", e)
    }
  }

  const StatusBadge = ({ status }: { status: RecordStatus }) => {
    const config = STATUS_CONFIG[status]
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
        style={{
          backgroundColor: config.bgColor,
          color: config.color,
          border: `1px solid ${config.borderColor}`,
        }}
      >
        {status === "processed" && <CheckCircle className="w-3 h-3" />}
        {status === "pending" && <Clock className="w-3 h-3" />}
        {status === "returned" && <XCircle className="w-3 h-3" />}
        {config.label}
      </span>
    )
  }

  const StatusSelector = ({
    groupId,
    currentStatus,
  }: {
    groupId: string
    currentStatus: RecordStatus
  }) => {
    const statuses: RecordStatus[] = ["processed", "pending", "returned"]
    return (
      <div className="flex gap-1">
        {statuses.map((status) => {
          const config = STATUS_CONFIG[status]
          const isActive = currentStatus === status
          return (
            <button
              key={status}
              onClick={() => handleStatusChange(groupId, status)}
              className={cn(
                "px-2 py-0.5 rounded text-xs font-medium transition-all border",
                isActive ? "" : "opacity-50 hover:opacity-80"
              )}
              style={{
                backgroundColor: isActive ? config.bgColor : "transparent",
                color: config.color,
                borderColor: isActive ? config.borderColor : "transparent",
              }}
            >
              {config.label}
            </button>
          )
        })}
      </div>
    )
  }

  const getGroupMemberSvg = () => {
    const rows: JSX.Element[] = []
    let yOffset = 30

    groups.forEach((group, groupIndex) => {
      const color = getGroupColor(groupIndex)
      const members = group.memberIds.map((id) => nodeMap.get(id)).filter(Boolean)

      rows.push(
        <text
          key={`title-${group.id}`}
          x={20}
          y={yOffset}
          fill={color}
          fontSize={14}
          fontWeight={600}
        >
          {group.name} ({members.length}人)
        </text>
      )
      yOffset += 25

      members.forEach((member, memberIndex) => {
        if (!member) return
        const xOffset = 40 + (memberIndex % 5) * 120
        if (memberIndex % 5 === 0 && memberIndex > 0) {
          yOffset += 25
        }
        rows.push(
          <circle
            key={`dot-${member.id}`}
            cx={xOffset}
            cy={yOffset - 6}
            r={6}
            fill={color}
            opacity={0.8}
          />
        )
        rows.push(
          <text
            key={`name-${member.id}`}
            x={xOffset + 15}
            y={yOffset - 2}
            fill="#e2e8f0"
            fontSize={12}
          >
            {member.name}
          </text>
        )
      })
      yOffset += 35
    })

    const height = yOffset + 20
    const width = 640

    return (
      <svg width={width} height={height} className="hidden">
        <rect width={width} height={height} fill="#0f172a" />
        {rows}
      </svg>
    )
  }

  return (
    <div className="h-full flex flex-col bg-slate-950/50">
      <div className="px-6 py-4 border-b border-slate-700/50 flex items-center justify-between bg-slate-900/80 backdrop-blur-sm">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <FileCode className="w-5 h-5 text-blue-400" />
            分组报告
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            共 {groups.length} 个分组，{conflicts.length} 条冲突记录
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg p-1 border border-slate-700/50">
            <button
              onClick={handleExportPNG}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-slate-300 hover:bg-slate-700/50 hover:text-white transition-colors"
            >
              <ImageIcon className="w-4 h-4" />
              PNG
            </button>
            <button
              onClick={handleExportSVG}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-slate-300 hover:bg-slate-700/50 hover:text-white transition-colors"
            >
              <Download className="w-4 h-4" />
              SVG
            </button>
            <button
              onClick={handleExportJSON}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-slate-300 hover:bg-slate-700/50 hover:text-white transition-colors"
            >
              <FileJson className="w-4 h-4" />
              JSON
            </button>
          </div>
          <button
            onClick={handleSaveHistory}
            className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Save className="w-4 h-4" />
            保存到历史
          </button>
        </div>
      </div>

      <div ref={reportRef} className="flex-1 flex overflow-hidden">
        {getGroupMemberSvg()}

        <div className="w-1/2 border-r border-slate-700/50 overflow-y-auto scrollbar-thin">
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-blue-400" />
              <h3 className="text-base font-semibold text-white">成员墙</h3>
              <span className="text-xs text-slate-400 bg-slate-800/50 px-2 py-0.5 rounded">
                {groups.length} 组
              </span>
            </div>

            {groups.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>暂无分组数据</p>
              </div>
            ) : (
              groups.map((group, index) => {
                const isExpanded = expandedGroups.has(group.id)
                const color = getGroupColor(index)
                const conflictCount = getConflictCountForGroup(group.id)
                const members = group.memberIds
                  .map((id) => nodeMap.get(id))
                  .filter(Boolean)

                return (
                  <div
                    key={group.id}
                    className="bg-slate-900/80 border border-slate-700/50 rounded-xl overflow-hidden backdrop-blur-sm transition-all duration-200 hover:border-slate-600/50"
                  >
                    <button
                      onClick={() => toggleGroup(group.id)}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-800/30 transition-colors"
                    >
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <div className="flex-1 text-left">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-white">
                            {group.name}
                          </span>
                          <span className="text-xs text-slate-400">
                            {members.length} 人
                          </span>
                          {conflictCount > 0 && (
                            <span className="text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">
                              {conflictCount} 冲突
                            </span>
                          )}
                        </div>
                      </div>
                      <StatusBadge status={group.status} />
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-slate-700/30 animate-fade-in">
                        <div className="pt-3 mb-3">
                          <p className="text-xs text-slate-400 mb-2">修改状态：</p>
                          <StatusSelector
                            groupId={group.id}
                            currentStatus={group.status}
                          />
                        </div>
                        <p className="text-xs text-slate-400 mb-2">成员列表：</p>
                        <div className="grid grid-cols-2 gap-2">
                          {members.map((member) => (
                            <div
                              key={member!.id}
                              className="flex items-center gap-2 px-2 py-1.5 bg-slate-800/50 rounded-lg border border-slate-700/30"
                            >
                              <div
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ backgroundColor: color }}
                              />
                              <span className="text-sm text-slate-200 truncate">
                                {member!.name}
                              </span>
                              {member!.projectLabels.length > 0 && (
                                <span className="text-[10px] text-slate-500 ml-auto">
                                  {member!.projectLabels.length}标签
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div className="w-1/2 overflow-y-auto scrollbar-thin">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-semibold text-white">冲突摘要</h3>
                <span className="text-xs text-slate-400 bg-slate-800/50 px-2 py-0.5 rounded">
                  {filteredConflicts.length} / {conflicts.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <select
                  value={severityFilter}
                  onChange={(e) =>
                    setSeverityFilter(e.target.value as ConflictSeverity | "all")
                  }
                  className="bg-slate-800/50 border border-slate-700/50 rounded-md px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-blue-500/50"
                >
                  <option value="all">全部严重度</option>
                  <option value="fatal">致命</option>
                  <option value="warning">警告</option>
                  <option value="info">提示</option>
                </select>
                <select
                  value={typeFilter}
                  onChange={(e) =>
                    setTypeFilter(e.target.value as ConflictType | "all")
                  }
                  className="bg-slate-800/50 border border-slate-700/50 rounded-md px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-blue-500/50"
                >
                  <option value="all">全部类型</option>
                  <option value="isolated_node">孤立节点</option>
                  <option value="strong_relation_split">强关系拆散</option>
                  <option value="capacity_overflow">容量越界</option>
                </select>
              </div>
            </div>

            {conflicts.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-30 text-green-500" />
                <p>没有发现冲突</p>
              </div>
            ) : filteredConflicts.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Filter className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>没有符合筛选条件的冲突</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredConflicts.map((conflict) => {
                  const severityConfig = SEVERITY_CONFIG[conflict.severity]
                  return (
                    <div
                      key={conflict.id}
                      className="rounded-xl border overflow-hidden backdrop-blur-sm transition-all duration-200 hover:border-opacity-80"
                      style={{
                        backgroundColor: severityConfig.bgColor,
                        borderColor: severityConfig.borderColor,
                      }}
                    >
                      <div className="px-4 py-3">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span
                              className="px-2 py-0.5 rounded text-xs font-medium"
                              style={{
                                backgroundColor: "rgba(255,255,255,0.1)",
                                color: severityConfig.color,
                              }}
                            >
                              {severityConfig.label}
                            </span>
                            <span className="text-xs text-slate-400 bg-slate-800/30 px-2 py-0.5 rounded">
                              {CONFLICT_TYPE_LABELS[conflict.type]}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {conflict.id.slice(-8)}
                          </span>
                        </div>
                        <p className="text-sm text-slate-200 mb-2">
                          {conflict.description}
                        </p>
                        <div className="text-xs text-slate-400 mb-2">
                          <span className="text-slate-500">受影响节点：</span>
                          {conflict.affectedNodeIds
                            .map((id) => getNodeName(id))
                            .join("、")}
                        </div>
                        <div className="flex items-start gap-2 text-xs">
                          <span className="text-blue-400 flex-shrink-0 mt-0.5">
                            建议：
                          </span>
                          <span className="text-slate-300">{conflict.suggestion}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
