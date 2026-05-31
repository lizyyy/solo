import type { RehearsalRecord, AnomalyDetail } from '../types.js'

export function checkDuplicateStudent(
  records: RehearsalRecord[]
): AnomalyDetail[] {
  const anomalies: AnomalyDetail[] = []
  const byStudent = new Map<string, RehearsalRecord[]>()

  for (const r of records) {
    const existing = byStudent.get(r.studentName) ?? []
    existing.push(r)
    byStudent.set(r.studentName, existing)
  }

  for (const [studentName, studentRecords] of byStudent) {
    if (studentRecords.length <= 1) continue

    const measureOverlaps = findOverlappingRecords(studentRecords)

    for (const overlap of measureOverlaps) {
      const [recA, recB] = overlap
      const overlapStart = Math.max(recA.measureRange[0], recB.measureRange[0])
      const overlapEnd = Math.min(recA.measureRange[1], recB.measureRange[1])

      anomalies.push({
        type: 'duplicate_student',
        description: `学生"${studentName}"在相同小节范围被重复统计：记录"${recA.id}"（第${recA.measureRange[0]}-${recA.measureRange[1]}小节，分谱"${recA.partName}"）与记录"${recB.id}"（第${recB.measureRange[0]}-${recB.measureRange[1]}小节，分谱"${recB.partName}"）重叠第${overlapStart}-${overlapEnd}小节`,
        affectedRecordIds: [recA.id, recB.id],
        reasoning: `同一学生在同一小节范围内出现两条记录，且小节范围存在重叠（第${overlapStart}-${overlapEnd}小节），可能导致该学生被重复统计。自动判断依据：同一学生在同一时间段内不应被计入多个分谱的同一小节，除非明确标注为兼任。`,
        suggestion: `请核实学生"${studentName}"是否确实同时演奏两个分谱；若是兼任请在备注中标注，否则请删除重复记录。`,
      })
    }
  }

  return anomalies
}

function findOverlappingRecords(
  records: RehearsalRecord[]
): [RehearsalRecord, RehearsalRecord][] {
  const overlaps: [RehearsalRecord, RehearsalRecord][] = []

  for (let i = 0; i < records.length; i++) {
    for (let j = i + 1; j < records.length; j++) {
      const a = records[i]
      const b = records[j]
      const hasOverlap =
        a.measureRange[0] <= b.measureRange[1] &&
        b.measureRange[0] <= a.measureRange[1]

      if (hasOverlap) {
        overlaps.push([a, b])
      }
    }
  }

  return overlaps
}
