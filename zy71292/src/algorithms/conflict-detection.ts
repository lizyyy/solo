import type { GraphNode, GraphEdge, BlacklistEntry, CapacityConfig, Conflict } from "@/types"

export function detectConflicts(
  nodes: GraphNode[],
  edges: GraphEdge[],
  groups: { id: string; name?: string; memberIds: string[] }[],
  blacklist: BlacklistEntry[],
  capacityConfig: CapacityConfig,
  strongRelationThreshold: number
): Conflict[] {
  const conflicts: Conflict[] = []
  let conflictId = 0

  const nodeIdToGroup: Record<string, string> = {}
  for (const group of groups) {
    for (const memberId of group.memberIds) {
      nodeIdToGroup[memberId] = group.id
    }
  }

  const adjSet = new Set<string>()
  for (const node of nodes) {
    const hasEdge = edges.some(
      (e) => e.source === node.id || e.target === node.id
    )
    if (!hasEdge) {
      adjSet.add(node.id)
    }
  }

  for (const nodeId of adjSet) {
    const groupId = nodeIdToGroup[nodeId]
    conflicts.push({
      id: `conflict-${conflictId++}`,
      type: "isolated_node",
      severity: "info",
      description: `节点 ${nodeId} 没有任何互动边连接，属于孤立节点`,
      affectedNodeIds: [nodeId],
      affectedGroupIds: groupId ? [groupId] : [],
      suggestion: "建议将孤立节点归入待确认组，由运营人员手动分配",
    })
  }

  for (const edge of edges) {
    if (edge.weight >= strongRelationThreshold) {
      const sourceGroup = nodeIdToGroup[edge.source]
      const targetGroup = nodeIdToGroup[edge.target]
      if (sourceGroup && targetGroup && sourceGroup !== targetGroup) {
        conflicts.push({
          id: `conflict-${conflictId++}`,
          type: "strong_relation_split",
          severity: "fatal",
          description: `强关系边 (${edge.source} ↔ ${edge.target}, 权重=${edge.weight.toFixed(2)}) 被拆散到不同组`,
          affectedNodeIds: [edge.source, edge.target],
          affectedGroupIds: [sourceGroup, targetGroup],
          suggestion: "建议将这两个节点合并到同一组，或降低强关系阈值重新计算",
        })
      }
    }
  }

  for (const group of groups) {
    if (group.memberIds.length > capacityConfig.maxSize) {
      conflicts.push({
        id: `conflict-${conflictId++}`,
        type: "capacity_overflow",
        severity: "warning",
        description: `组 ${group.name || group.id} 有 ${group.memberIds.length} 人，超过最大容量 ${capacityConfig.maxSize}`,
        affectedNodeIds: group.memberIds,
        affectedGroupIds: [group.id],
        suggestion: `建议将此组拆分为多个小组，或增大最大容量至 ${group.memberIds.length}`,
      })
    }
    if (group.memberIds.length < capacityConfig.minSize && group.memberIds.length > 0) {
      conflicts.push({
        id: `conflict-${conflictId++}`,
        type: "capacity_overflow",
        severity: "warning",
        description: `组 ${group.name || group.id} 仅有 ${group.memberIds.length} 人，低于最小容量 ${capacityConfig.minSize}`,
        affectedNodeIds: group.memberIds,
        affectedGroupIds: [group.id],
        suggestion: `建议将此组合并到其他组，或降低最小容量至 ${group.memberIds.length}`,
      })
    }
  }

  for (const entry of blacklist) {
    const groupA = nodeIdToGroup[entry.nodeA]
    const groupB = nodeIdToGroup[entry.nodeB]
    if (groupA && groupB && groupA === groupB) {
      conflicts.push({
        id: `conflict-${conflictId++}`,
        type: "strong_relation_split",
        severity: "fatal",
        description: `黑名单节点 ${entry.nodeA} 和 ${entry.nodeB} 被分到同一组（原因：${entry.reason}）`,
        affectedNodeIds: [entry.nodeA, entry.nodeB],
        affectedGroupIds: [groupA],
        suggestion: "建议将其中一个节点移至其他组，或在黑名单中移除此条目",
      })
    }
  }

  return conflicts.sort((a, b) => {
    const severityOrder = { fatal: 0, warning: 1, info: 2 }
    return severityOrder[a.severity] - severityOrder[b.severity]
  })
}
