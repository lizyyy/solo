import type { FontRecord, AnomalyItem } from '@/types'

export function generateDeliveryNote(
  records: FontRecord[],
  anomalies: AnomalyItem[],
  operator: string
): string {
  const now = new Date()
  const dateStr = now.toISOString().replace('T', ' ').slice(0, 19)

  const confirmed = records.filter((r) => r.status === 'confirmed')
  const pending = records.filter((r) => r.status === 'pending')
  const expired = records.filter((r) => r.status === 'expired')
  const conflict = records.filter((r) => r.status === 'conflict')

  const lines: string[] = []
  lines.push(`# 字体授权交付说明`)
  lines.push(``)
  lines.push(`**导出时间**：${dateStr}`)
  lines.push(`**操作人**：${operator}`)
  lines.push(`**总记录数**：${records.length}`)
  lines.push(``)
  lines.push(`## 状态统计`)
  lines.push(`- 已确认：${confirmed.length} 条`)
  lines.push(`- 待确认：${pending.length} 条`)
  lines.push(`- 已过期：${expired.length} 条`)
  lines.push(`- 冲突：${conflict.length} 条`)
  lines.push(``)

  if (anomalies.length > 0) {
    lines.push(`## 异常项（${anomalies.length} 项）`)
    lines.push(``)
    lines.push(`> ⚠ 以下条目标记为"待确认"，请勿直接纳入正常交付`)
    lines.push(``)
    const grouped = new Map<string, AnomalyItem[]>()
    for (const a of anomalies) {
      const list = grouped.get(a.type) || []
      list.push(a)
      grouped.set(a.type, list)
    }
    const typeLabels: Record<string, string> = {
      expired: '授权过期/即将过期',
      spec_mismatch: '导出规格异常',
      color_mismatch: '色卡版本混用',
      missing_field: '必填字段缺失',
    }
    for (const [type, items] of grouped) {
      lines.push(`### ${typeLabels[type] || type}`)
      for (const item of items) {
        const rec = records.find((r) => r.id === item.recordId)
        lines.push(`- ${rec?.fontName ?? item.recordId}：${item.reason}`)
      }
      lines.push(``)
    }
  }

  lines.push(`## 已确认条目`)
  lines.push(``)
  if (confirmed.length > 0) {
    lines.push(`| 字体名称 | 厂商 | 授权类型 | 到期日 | 色卡版本 |`)
    lines.push(`|----------|------|----------|--------|----------|`)
    for (const r of confirmed) {
      lines.push(`| ${r.fontName} | ${r.foundry} | ${r.licenseType} | ${r.expiryDate || '-'} | ${r.colorCardVersion || '-'} |`)
    }
  } else {
    lines.push(`*无已确认条目*`)
  }
  lines.push(``)
  lines.push(`---`)
  lines.push(`*本说明由字体授权追踪系统自动生成*`)

  return lines.join('\n')
}
