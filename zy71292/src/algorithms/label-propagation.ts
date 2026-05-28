import type { GraphNode, GraphEdge } from "@/types"

interface AdjacencyList {
  [nodeId: string]: string[]
}

function buildAdjacencyList(edges: GraphEdge[]): AdjacencyList {
  const adj: AdjacencyList = {}
  for (const edge of edges) {
    if (!adj[edge.source]) adj[edge.source] = []
    if (!adj[edge.target]) adj[edge.target] = []
    adj[edge.source].push(edge.target)
    adj[edge.target].push(edge.source)
  }
  return adj
}

function getProjectConstraintGroups(
  nodes: GraphNode[],
  projectLabels: Record<string, string[]>
): Map<string, string> {
  const representative: Map<string, string> = new Map()
  const nodeLabels: Record<string, string[]> = {}
  for (const node of nodes) {
    nodeLabels[node.id] = node.projectLabels
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

  for (const nodeId of Object.keys(nodeLabels)) {
    const projects = nodeLabels[nodeId]
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

  for (const memberSet of Object.values(mergedGroups)) {
    const members = [...memberSet]
    if (members.length > 1) {
      const rep = members[0]
      for (const id of members) {
        representative.set(id, rep)
      }
    }
  }

  return representative
}

export function labelPropagation(
  nodes: GraphNode[],
  edges: GraphEdge[],
  projectLabels: Record<string, string[]>
): Record<string, number> {
  const adj = buildAdjacencyList(edges)
  const nodeIds = nodes.map((n) => n.id)
  if (nodeIds.length === 0) return {}

  const constraintRep = getProjectConstraintGroups(nodes, projectLabels)

  const labels: Record<string, number> = {}
  nodeIds.forEach((id, i) => {
    const rep = constraintRep.get(id)
    if (rep && rep !== id && labels[rep] !== undefined) {
      labels[id] = labels[rep]
    } else {
      labels[id] = i
    }
  })

  let changed = true
  let iterations = 0
  const maxIterations = 100

  while (changed && iterations < maxIterations) {
    changed = false
    iterations++

    const shuffled = [...nodeIds].sort(() => Math.random() - 0.5)

    for (const nodeId of shuffled) {
      if (constraintRep.has(nodeId) && constraintRep.get(nodeId) !== nodeId) {
        continue
      }

      const neighbors = adj[nodeId] || []
      if (neighbors.length === 0) continue

      const labelCounts: Record<number, number> = {}
      for (const neighbor of neighbors) {
        const lbl = labels[neighbor]
        labelCounts[lbl] = (labelCounts[lbl] || 0) + 1
      }

      let maxCount = 0
      let bestLabel = labels[nodeId]
      for (const [lbl, count] of Object.entries(labelCounts)) {
        if (count > maxCount || (count === maxCount && Math.random() > 0.5)) {
          maxCount = count
          bestLabel = Number(lbl)
        }
      }

      if (bestLabel !== labels[nodeId]) {
        labels[nodeId] = bestLabel
        changed = true

        if (constraintRep.has(nodeId)) {
          for (const [otherId, rep] of constraintRep.entries()) {
            if (rep === nodeId && otherId !== nodeId) {
              labels[otherId] = bestLabel
            }
          }
        }
      }
    }
  }

  const uniqueLabels = [...new Set(Object.values(labels))]
  const remap: Record<number, number> = {}
  uniqueLabels.forEach((lbl, i) => {
    remap[lbl] = i
  })
  for (const id of nodeIds) {
    labels[id] = remap[labels[id]]
  }

  return labels
}
