import type { GraphNode, GraphEdge, BlacklistEntry, CapacityConfig, GroupResult, AlgorithmConfig } from "@/types"
import { louvain } from "./louvain"
import { labelPropagation } from "./label-propagation"
import { detectConflicts } from "./conflict-detection"

export function runCommunityDetection(
  nodes: GraphNode[],
  edges: GraphEdge[],
  blacklist: BlacklistEntry[],
  capacityConfig: CapacityConfig,
  algorithmConfig: AlgorithmConfig,
  projectLabels: Record<string, string[]>
): { groups: GroupResult[]; conflicts: ReturnType<typeof detectConflicts> } {
  if (nodes.length === 0) return { groups: [], conflicts: [] }

  let communityMap: Record<string, number>

  if (algorithmConfig.algorithm === "louvain") {
    communityMap = louvain(nodes, edges, projectLabels, algorithmConfig.resolution)
  } else {
    communityMap = labelPropagation(nodes, edges, projectLabels)
  }

  const groupMap: Record<number, string[]> = {}
  for (const [nodeId, commId] of Object.entries(communityMap)) {
    if (!groupMap[commId]) groupMap[commId] = []
    groupMap[commId].push(nodeId)
  }

  const groups: GroupResult[] = Object.entries(groupMap).map(
    ([commId, memberIds], idx) => {
      const hasIsolated = memberIds.some((id) =>
        !edges.some((e) => e.source === id || e.target === id)
      )
      const overCapacity = memberIds.length > capacityConfig.maxSize
      const underCapacity = memberIds.length < capacityConfig.minSize

      let status: GroupResult["status"] = "processed"
      if (hasIsolated || overCapacity || underCapacity) {
        status = "pending"
      }

      return {
        id: `group-${commId}`,
        name: `分组 ${idx + 1}`,
        memberIds,
        status,
      }
    }
  )

  const conflicts = detectConflicts(
    nodes,
    edges,
    groups,
    blacklist,
    capacityConfig,
    algorithmConfig.strongRelationThreshold
  )

  for (const conflict of conflicts) {
    if (conflict.severity === "fatal") {
      for (const gId of conflict.affectedGroupIds) {
        const group = groups.find((g) => g.id === gId)
        if (group && group.status !== "returned") {
          group.status = "returned"
        }
      }
    } else if (conflict.severity === "warning") {
      for (const gId of conflict.affectedGroupIds) {
        const group = groups.find((g) => g.id === gId)
        if (group && group.status === "processed") {
          group.status = "pending"
        }
      }
    }
  }

  return { groups, conflicts }
}
