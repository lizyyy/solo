import type { RiskItem, LineageNode, LineageEdge, FieldAlias, RiskSeverity } from '@/types'
import { findBreakpoints } from './lineageTracker'
import { detectAliasConflicts } from './aliasMerger'

export function analyzeRisks(
  nodes: LineageNode[],
  edges: LineageEdge[],
  aliases: FieldAlias[],
  existingRisks: RiskItem[]
): RiskItem[] {
  const risks: RiskItem[] = [...existingRisks]
  const existingIds = new Set(risks.map((r) => r.id))

  const breakpoints = findBreakpoints(nodes, edges)
  for (const bp of breakpoints) {
    const riskId = `auto_bp_${bp.id}`
    if (!existingIds.has(riskId)) {
      const sourceNode = nodes.find((n) => n.id === bp.source)
      const targetNode = nodes.find((n) => n.id === bp.target)
      risks.push({
        id: riskId,
        riskType: bp.status === 'broken' ? 'lineage_break' : 'unregistered_downstream',
        severity: bp.status === 'broken' ? 'high' : 'medium',
        fieldId: bp.source,
        description: `${bp.status === 'broken' ? '血缘断点' : '未登记关系'}：${sourceNode?.label || bp.source} → ${targetNode?.label || bp.target}`,
        impactRange: targetNode?.label || bp.target,
        status: 'pending',
        resolvedBy: '',
        resolvedAt: '',
      })
      existingIds.add(riskId)
    }
  }

  const conflicts = detectAliasConflicts(aliases)
  for (const conflict of conflicts) {
    const riskId = `auto_ac_${conflict.aliasName}`
    if (!existingIds.has(riskId)) {
      risks.push({
        id: riskId,
        riskType: 'alias_conflict',
        severity: conflict.type === 'name_collision' ? 'medium' : 'low',
        fieldId: conflict.fieldIds[0],
        description: `别名冲突："${conflict.aliasName}" 同时被 ${conflict.fieldLabels.join('、')} 使用`,
        impactRange: conflict.fieldLabels.join('、'),
        status: 'pending',
        resolvedBy: '',
        resolvedAt: '',
      })
      existingIds.add(riskId)
    }
  }

  const hiddenFields = nodes.filter((n) => n.isHidden && n.status === 'changed')
  for (const hf of hiddenFields) {
    const riskId = `auto_hf_${hf.id}`
    if (!existingIds.has(riskId)) {
      risks.push({
        id: riskId,
        riskType: 'unregistered_field',
        severity: 'high',
        fieldId: hf.id,
        description: `隐藏字段 ${hf.label} 已变更但未正式登记`,
        impactRange: '所有依赖此隐藏字段的下游任务和报表',
        status: 'pending',
        resolvedBy: '',
        resolvedAt: '',
      })
      existingIds.add(riskId)
    }
  }

  return risks.sort((a, b) => severityOrder(a.severity) - severityOrder(b.severity))
}

function severityOrder(s: RiskSeverity): number {
  return s === 'high' ? 0 : s === 'medium' ? 1 : 2
}

export function getRiskStats(risks: RiskItem[]) {
  return {
    total: risks.length,
    pending: risks.filter((r) => r.status === 'pending').length,
    confirmed: risks.filter((r) => r.status === 'confirmed').length,
    ignored: risks.filter((r) => r.status === 'ignored').length,
    high: risks.filter((r) => r.severity === 'high').length,
    medium: risks.filter((r) => r.severity === 'medium').length,
    low: risks.filter((r) => r.severity === 'low').length,
  }
}
