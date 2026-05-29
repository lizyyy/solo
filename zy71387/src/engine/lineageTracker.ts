import type { LineageNode, LineageEdge } from '@/types'

export function findDownstream(
  nodeId: string,
  nodes: LineageNode[],
  edges: LineageEdge[],
  visited: Set<string> = new Set()
): { node: LineageNode; edge: LineageEdge }[] {
  const result: { node: LineageNode; edge: LineageEdge }[] = []
  if (visited.has(nodeId)) return result
  visited.add(nodeId)

  const outEdges = edges.filter((e) => e.source === nodeId)
  for (const edge of outEdges) {
    const targetNode = nodes.find((n) => n.id === edge.target)
    if (targetNode) {
      result.push({ node: targetNode, edge })
      result.push(...findDownstream(edge.target, nodes, edges, visited))
    }
  }
  return result
}

export function findUpstream(
  nodeId: string,
  nodes: LineageNode[],
  edges: LineageEdge[],
  visited: Set<string> = new Set()
): { node: LineageNode; edge: LineageEdge }[] {
  const result: { node: LineageNode; edge: LineageEdge }[] = []
  if (visited.has(nodeId)) return result
  visited.add(nodeId)

  const inEdges = edges.filter((e) => e.target === nodeId)
  for (const edge of inEdges) {
    const sourceNode = nodes.find((n) => n.id === edge.source)
    if (sourceNode) {
      result.push({ node: sourceNode, edge })
      result.push(...findUpstream(edge.source, nodes, edges, visited))
    }
  }
  return result
}

export function findBreakpoints(nodes: LineageNode[], edges: LineageEdge[]): LineageEdge[] {
  return edges.filter((e) => e.status === 'broken' || e.status === 'unregistered')
}

export function getConnectedNodeIds(
  nodeId: string,
  edges: LineageEdge[],
  depth: number = 3
): Set<string> {
  const connected = new Set<string>()
  const queue: { id: string; d: number }[] = [{ id: nodeId, d: 0 }]
  connected.add(nodeId)

  while (queue.length > 0) {
    const current = queue.shift()!
    if (current.d >= depth) continue

    for (const edge of edges) {
      if (edge.source === current.id && !connected.has(edge.target)) {
        connected.add(edge.target)
        queue.push({ id: edge.target, d: current.d + 1 })
      }
      if (edge.target === current.id && !connected.has(edge.source)) {
        connected.add(edge.source)
        queue.push({ id: edge.source, d: current.d + 1 })
      }
    }
  }
  return connected
}
