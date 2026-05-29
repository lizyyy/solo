import type { LineageNode, LineageEdge, ImpactResult, RiskSeverity } from '@/types'
import { findDownstream } from './lineageTracker'

export function scanImpact(
  fieldIdOrAlias: string,
  nodes: LineageNode[],
  edges: LineageEdge[]
): ImpactResult[] {
  const matchedNodes = findMatchingNodes(fieldIdOrAlias, nodes)
  if (matchedNodes.length === 0) {
    return [
      {
        nodeId: '',
        nodeType: 'field',
        label: fieldIdOrAlias,
        severity: 'high',
        path: [],
        reason: '未找到匹配字段，可能是未登记字段',
      },
    ]
  }

  const results: ImpactResult[] = []
  for (const node of matchedNodes) {
    const downstream = findDownstream(node.id, nodes, edges)
    for (const item of downstream) {
      const severity = calculateSeverity(item.node, item.edge)
      results.push({
        nodeId: item.node.id,
        nodeType: item.node.type,
        label: item.node.label,
        severity,
        path: [node.label, item.node.label],
        reason: getImpactReason(item.edge, item.node),
      })
    }
  }
  return results
}

function findMatchingNodes(query: string, nodes: LineageNode[]): LineageNode[] {
  const q = query.toLowerCase().trim()
  return nodes.filter(
    (n) =>
      n.id.toLowerCase().includes(q) ||
      n.label.toLowerCase().includes(q) ||
      n.aliases.some((a) => a.toLowerCase().includes(q))
  )
}

function calculateSeverity(node: LineageNode, edge: LineageEdge): RiskSeverity {
  if (edge.status === 'broken') return 'high'
  if (edge.status === 'unregistered') return 'medium'
  if (node.status === 'changed') return 'low'
  return 'low'
}

function getImpactReason(edge: LineageEdge, node: LineageNode): string {
  if (edge.status === 'broken') return `血缘断点：${node.label} 的上游链路已断裂`
  if (edge.status === 'unregistered') return `未登记关系：${node.label} 的上游依赖未正式登记`
  if (node.status === 'changed') return `${node.label} 受上游字段变更影响`
  return `${node.label} 间接受影响`
}
