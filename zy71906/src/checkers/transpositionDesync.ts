import type { RehearsalRecord, AnomalyDetail } from '../types.js'

export function checkTranspositionDesync(
  records: RehearsalRecord[]
): AnomalyDetail[] {
  const anomalies: AnomalyDetail[] = []
  const byMeasureRange = new Map<string, RehearsalRecord[]>()

  for (const r of records) {
    const key = `${r.measureRange[0]}-${r.measureRange[1]}`
    const existing = byMeasureRange.get(key) ?? []
    existing.push(r)
    byMeasureRange.set(key, existing)
  }

  for (const [range, group] of byMeasureRange) {
    if (group.length < 2) continue

    const keySigs = new Map<string, RehearsalRecord[]>()
    for (const r of group) {
      const existing = keySigs.get(r.keySignature) ?? []
      existing.push(r)
      keySigs.set(r.keySignature, existing)
    }

    if (keySigs.size <= 1) continue

    const sigEntries = [...keySigs.entries()]
    const allAffectedIds = group.map((r) => r.id)
    const sigSummary = sigEntries
      .map(
        ([sig, recs]) =>
          `调号"${sig}"（分谱：${recs.map((r) => r.partName).join('、')}）`
      )
      .join('；')

    anomalies.push({
      type: 'transposition_desync',
      description: `小节${range}存在转调不同步：${sigSummary}`,
      affectedRecordIds: allAffectedIds,
      reasoning: `同一小节范围内不同分谱的调号不一致，说明转调操作未在所有分谱间同步。自动判断依据：同一段落的各分谱调号应保持一致（移调乐器除外），不一致则可能导致演奏音高冲突。`,
      suggestion: `请核实小节${range}的转调标记是否在所有分谱中同步更新；若为移调乐器的正常调号差异，请在备注中注明该分谱为移调乐器。`,
    })
  }

  return anomalies
}
