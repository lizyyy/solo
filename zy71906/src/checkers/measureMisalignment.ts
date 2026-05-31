import type { RehearsalRecord, AnomalyDetail } from '../types.js'

export function checkMeasureMisalignment(
  records: RehearsalRecord[]
): AnomalyDetail[] {
  const anomalies: AnomalyDetail[] = []
  const byPart = new Map<string, RehearsalRecord[]>()

  for (const r of records) {
    const existing = byPart.get(r.partName) ?? []
    existing.push(r)
    byPart.set(r.partName, existing)
  }

  for (const [partName, partRecords] of byPart) {
    const sorted = [...partRecords].sort(
      (a, b) => a.measureRange[0] - b.measureRange[0]
    )

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]
      const curr = sorted[i]
      const prevEnd = prev.measureRange[1]
      const currStart = curr.measureRange[0]

      if (currStart > prevEnd + 1) {
        anomalies.push({
          type: 'measure_misalignment',
          description: `分谱"${partName}"存在小节跳跃：记录"${prev.id}"止于第${prevEnd}小节，记录"${curr.id}"始于第${currStart}小节，中间缺少第${prevEnd + 1}至第${currStart - 1}小节`,
          affectedRecordIds: [prev.id, curr.id],
          reasoning: `同一分谱中前后两条记录的小节范围不连续（第${prevEnd}小节→第${currStart}小节），可能存在小节遗漏或错位。自动判断依据：连续记录的小节范围应首尾相接或重叠，不允许出现间隔。`,
          suggestion: `请核实分谱"${partName}"第${prevEnd + 1}至第${currStart - 1}小节是否有遗漏记录；若为刻意跳过（如反复记号），请在备注中说明。`,
        })
      } else if (currStart < prevEnd) {
        anomalies.push({
          type: 'measure_misalignment',
          description: `分谱"${partName}"存在小节重叠：记录"${prev.id}"覆盖第${prev.measureRange[0]}-${prevEnd}小节，记录"${curr.id}"覆盖第${currStart}-${curr.measureRange[1]}小节，重叠第${currStart}-${prevEnd}小节`,
          affectedRecordIds: [prev.id, curr.id],
          reasoning: `同一分谱中两条记录的小节范围存在重叠（第${currStart}-${prevEnd}小节同时出现在两条记录中），可能是小节错位或重复录入。自动判断依据：同分谱的连续记录不应出现非重叠性的范围交叉。`,
          suggestion: `请核实分谱"${partName}"第${currStart}-${prevEnd}小节是否被重复统计；若为分段练习同一小节，请标注区分。`,
        })
      }
    }
  }

  return anomalies
}
