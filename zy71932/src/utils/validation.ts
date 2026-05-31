import type { FontRecord, ColorCard, AnomalyItem } from '@/types'

export function validateBeforeExport(
  ids: string[],
  records: FontRecord[],
  colorCards: ColorCard[]
): AnomalyItem[] {
  const anomalies: AnomalyItem[] = []
  const now = new Date()

  const cardVersionMap = new Map<string, string>()
  for (const card of colorCards) {
    cardVersionMap.set(card.id, card.version)
  }

  const cardIdByNameMap = new Map<string, { id: string; version: string }[]>()
  for (const card of colorCards) {
    const entries = cardIdByNameMap.get(card.name) || []
    entries.push({ id: card.id, version: card.version })
    cardIdByNameMap.set(card.name, entries)
  }

  const selected = records.filter((r) => ids.includes(r.id))

  for (const r of selected) {
    if (r.expiryDate) {
      const expiry = new Date(r.expiryDate)
      if (expiry < now) {
        anomalies.push({
          id: `expired-${r.id}`,
          recordId: r.id,
          reason: `授权已于 ${r.expiryDate} 过期`,
          type: 'expired',
        })
        continue
      }
      const thirtyDays = 30 * 24 * 60 * 60 * 1000
      if (expiry.getTime() - now.getTime() < thirtyDays) {
        anomalies.push({
          id: `expiring-${r.id}`,
          recordId: r.id,
          reason: `授权即将于 ${r.expiryDate} 过期（30天内）`,
          type: 'expired',
        })
      }
    } else {
      anomalies.push({
        id: `missing-expiry-${r.id}`,
        recordId: r.id,
        reason: '缺少到期日，无法确认授权有效性',
        type: 'missing_field',
      })
    }

    if (r.colorCardId && r.colorCardVersion) {
      const card = colorCards.find((c) => c.id === r.colorCardId)
      if (card && card.version !== r.colorCardVersion) {
        anomalies.push({
          id: `color-mismatch-${r.id}`,
          recordId: r.id,
          reason: `色卡版本不一致：记录关联 v${r.colorCardVersion}，色卡当前为 v${card.version}`,
          type: 'color_mismatch',
        })
      }
    }

    if (r.colorCardId && !r.colorCardVersion) {
      anomalies.push({
        id: `spec-mismatch-${r.id}`,
        recordId: r.id,
        reason: '已关联色卡但缺少版本号，导出规格可能不一致',
        type: 'spec_mismatch',
      })
    }

    if (r.status === 'pending' || r.status === 'conflict') {
      anomalies.push({
        id: `status-pending-${r.id}`,
        recordId: r.id,
        reason: `状态为"${r.status === 'pending' ? '待确认' : '冲突'}"，未完成确认`,
        type: 'spec_mismatch',
      })
    }
  }

  const colorVersionGroups = new Map<string, string[]>()
  for (const r of selected) {
    if (r.colorCardId) {
      const card = colorCards.find((c) => c.id === r.colorCardId)
      if (card) {
        const versions = colorVersionGroups.get(card.name) || []
        if (!versions.includes(r.colorCardVersion || '?')) {
          versions.push(r.colorCardVersion || '?')
        }
        colorVersionGroups.set(card.name, versions)
      }
    }
  }
  for (const [name, versions] of colorVersionGroups) {
    if (versions.length > 1) {
      const affected = selected.filter((r) => {
        const card = colorCards.find((c) => c.id === r.colorCardId)
        return card && card.name === name
      })
      for (const r of affected) {
        const existing = anomalies.find((a) => a.recordId === r.id && a.type === 'color_mismatch')
        if (!existing) {
          anomalies.push({
            id: `color-mix-${r.id}`,
            recordId: r.id,
            reason: `色卡"${name}"存在多个版本混用：${versions.join(', ')}`,
            type: 'color_mismatch',
          })
        }
      }
    }
  }

  return anomalies
}
