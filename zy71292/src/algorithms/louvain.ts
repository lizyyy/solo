import type { GraphNode, GraphEdge } from "@/types"

interface AdjacencyList {
  [nodeId: string]: { neighbor: string; weight: number }[]
}

function buildAdjacencyList(edges: GraphEdge[]): AdjacencyList {
  const adj: AdjacencyList = {}
  for (const edge of edges) {
    if (!adj[edge.source]) adj[edge.source] = []
    if (!adj[edge.target]) adj[edge.target] = []
    adj[edge.source].push({ neighbor: edge.target, weight: edge.weight })
    adj[edge.target].push({ neighbor: edge.source, weight: edge.weight })
  }
  return adj
}

function getProjectConstraintGroups(
  nodes: GraphNode[],
  projectLabels: Record<string, string[]>
): string[][] {
  const nodeProjectMap: Record<string, Set<string>> = {}
  for (const node of nodes) {
    nodeProjectMap[node.id] = new Set(node.projectLabels)
  }

  const parent: Record<string, string> = {}
  for (const projectId of Object.keys(projectLabels)) {
    parent[projectId] = projectId
  }

  const find = (x: string): string => {
    if (parent[x] !== x) parent[x] = find(parent[x])
    return parent[x]
  }

  const union = (x: string, y: string) => {
    const px = find(x)
    const py = find(y)
    if (px !== py) parent[px] = py
  }

  for (const nodeId of Object.keys(nodeProjectMap)) {
    const projects = [...nodeProjectMap[nodeId]]
    for (let i = 0; i < projects.length; i++) {
      for (let j = i + 1; j < projects.length; j++) {
        union(projects[i], projects[j])
      }
    }
  }

  const mergedGroups: Record<string, Set<string>> = {}
  for (const projectId of Object.keys(projectLabels)) {
    const root = find(projectId)
    if (!mergedGroups[root]) mergedGroups[root] = new Set()
    for (const memberId of projectLabels[projectId]) {
      mergedGroups[root].add(memberId)
    }
  }

  const groups: string[][] = []
  for (const memberSet of Object.values(mergedGroups)) {
    const members = [...memberSet]
    if (members.length > 1) {
      groups.push(members)
    }
  }

  return groups
}

export function louvain(
  nodes: GraphNode[],
  edges: GraphEdge[],
  projectLabels: Record<string, string[]>,
  resolution: number = 1.0
): Record<string, number> {
  const adj = buildAdjacencyList(edges)
  const nodeIds = nodes.map((n) => n.id)
  if (nodeIds.length === 0) return {}

  const constraintGroups = getProjectConstraintGroups(nodes, projectLabels)
  const nodeToConstraintGroup: Record<string, number> = {}
  constraintGroups.forEach((group, idx) => {
    group.forEach((nodeId) => {
      nodeToConstraintGroup[nodeId] = idx
    })
  })

  const community: Record<string, number> = {}
  let communityCounter = 0

  for (const id of nodeIds) {
    if (nodeToConstraintGroup[id] !== undefined) {
      const gIdx = nodeToConstraintGroup[id]
      const repId = constraintGroups[gIdx][0]
      if (community[repId] !== undefined) {
        community[id] = community[repId]
      } else {
        community[repId] = communityCounter
        community[id] = communityCounter
        communityCounter++
      }
    } else {
      community[id] = communityCounter++
    }
  }

  const m = edges.reduce((sum, e) => sum + e.weight, 0)
  if (m === 0) return community

  const degree: Record<string, number> = {}
  for (const id of nodeIds) {
    degree[id] = (adj[id] || []).reduce((s, n) => s + n.weight, 0)
  }

  const sigma: Record<number, number> = {}
  for (const id of nodeIds) {
    const c = community[id]
    sigma[c] = (sigma[c] || 0) + degree[id]
  }

  const ki_in = (
    nodeId: string,
    commId: number
  ): number => {
    let sum = 0
    for (const { neighbor, weight } of adj[nodeId] || []) {
      if (community[neighbor] === commId) sum += weight
    }
    return sum
  }

  let improved = true
  let iterations = 0
  const maxIterations = 50

  while (improved && iterations < maxIterations) {
    improved = false
    iterations++

    for (const nodeId of nodeIds) {
      const currentComm = community[nodeId]
      const ki = degree[nodeId]
      const kiInCurrent = ki_in(nodeId, currentComm)
      const sigmaCurrent = sigma[currentComm]

      let bestComm = currentComm
      let bestDelta = 0

      const neighborComms = new Set<number>()
      for (const { neighbor } of adj[nodeId] || []) {
        neighborComms.add(community[neighbor])
      }

      for (const targetComm of neighborComms) {
        if (targetComm === currentComm) continue

        let hasConstraintConflict = false
        for (const cid of Object.keys(nodeToConstraintGroup)) {
          if (community[cid] === targetComm) {
            const gIdx = nodeToConstraintGroup[cid]
            if (constraintGroups[gIdx].includes(nodeId)) {
              hasConstraintConflict = true
              break
            }
          }
        }
        if (hasConstraintConflict) continue

        const kiInTarget = ki_in(nodeId, targetComm)
        const sigmaTarget = sigma[targetComm]

        const delta =
          (kiInTarget - kiInCurrent) / m -
          (resolution * (sigmaTarget * ki - sigmaCurrent * ki)) /
            (2 * m * m)

        if (delta > bestDelta) {
          bestDelta = delta
          bestComm = targetComm
        }
      }

      if (bestComm !== currentComm) {
        if (nodeToConstraintGroup[nodeId] !== undefined) {
          const gIdx = nodeToConstraintGroup[nodeId]
          const groupMembers = constraintGroups[gIdx]
          let totalKi = 0
          for (const mid of groupMembers) {
            totalKi += degree[mid]
          }
          sigma[currentComm] -= totalKi
          sigma[bestComm] = (sigma[bestComm] || 0) + totalKi
          for (const mid of groupMembers) {
            community[mid] = bestComm
          }
        } else {
          sigma[currentComm] -= ki
          sigma[bestComm] = (sigma[bestComm] || 0) + ki
          community[nodeId] = bestComm
        }
        improved = true
      }
    }
  }

  const uniqueComms = [...new Set(Object.values(community))]
  const remap: Record<number, number> = {}
  uniqueComms.forEach((c, i) => {
    remap[c] = i
  })
  for (const id of nodeIds) {
    community[id] = remap[community[id]]
  }

  return community
}
