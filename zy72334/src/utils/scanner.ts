import type { BoundaryRecord, ColumnType, AuditEntry } from '@/types'

const DENOMINATOR_KEYWORDS = ['分母', '分', '权重', '总', 'sum', 'weight', 'total', 'score', '基数']

type DenomCandidate = { colIdx: number; colName: string; value: number; keywordScore: number }

function pickBestDenominator(candidates: DenomCandidate[]): DenomCandidate | null {
  if (candidates.length === 0) return null
  const sorted = [...candidates].sort((a, b) => b.keywordScore - a.keywordScore)
  return sorted[0]
}

function calcKeywordScore(name: string): number {
  const lower = name.toLowerCase()
  let score = 0
  for (const kw of DENOMINATOR_KEYWORDS) {
    if (lower.includes(kw.toLowerCase())) score += 10
  }
  return score
}

function now(): string {
  return new Date().toLocaleString('zh-CN')
}

function makeHistory(action: AuditEntry['action'], role: AuditEntry['role'], description: string, extras?: Partial<AuditEntry>): AuditEntry {
  return { timestamp: now(), action, role, description, ...extras }
}

export function scanBoundaryValues(
  headers: string[],
  columnTypes: ColumnType[],
  rows: string[][],
  numericMatrix: number[][]
): BoundaryRecord[] {
  const records: BoundaryRecord[] = []
  const keyed = new Map<string, BoundaryRecord>()

  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    for (let colIdx = 0; colIdx < headers.length; colIdx++) {
      if (columnTypes[colIdx] !== 'numeric') continue
      const cellValue = rows[rowIdx]?.[colIdx]
      if (cellValue !== '' && cellValue !== undefined && cellValue !== null) continue

      const denomCandidates: DenomCandidate[] = []
      for (let denomCol = 0; denomCol < headers.length; denomCol++) {
        if (denomCol === colIdx) continue
        if (columnTypes[denomCol] !== 'numeric') continue
        const denomVal = numericMatrix[rowIdx]?.[denomCol]
        if (denomVal !== 0) continue
        denomCandidates.push({
          colIdx: denomCol,
          colName: headers[denomCol],
          value: denomVal,
          keywordScore: calcKeywordScore(headers[denomCol]),
        })
      }

      if (denomCandidates.length === 0) continue

      const best = pickBestDenominator(denomCandidates)!
      const key = `${rowIdx}-${colIdx}`
      if (keyed.has(key)) continue

      const id = `br-${rowIdx}-${colIdx}`
      const orig = cellValue ?? ''
      const createdAt = now()

      const reason =
        `第 ${rowIdx + 1} 行「${headers[colIdx]}」为空字符串，而数值分母列「${best.colName}」的值为 0。` +
        `若此处意图计算比值（${headers[colIdx]} / ${best.colName}），则分母为 0 无法计算；` +
        `当前数据用空字符串占位，未显式标记异常，存在静默失真风险。`

      const missingMaterial =
        `需要「${best.colName}」列的实际非零分母值，或由数据复核人明确：` +
        `「${headers[colIdx]}」应为 null（非数值）、应填 0，还是需要修改对应「${best.colName}」的 0 值。` +
        (denomCandidates.length > 1
          ? `（本次自动从候选分母列 ${denomCandidates.map(c => `「${c.colName}」`).join('、')} 中选择「${best.colName}」作为最匹配的分母）`
          : '')

      const history = [
        makeHistory('创建', '数据复核人', `导入时扫描触发：发现分母为 0 的空值记录，自动选择「${best.colName}」作为关联分母列`, {
          field: headers[colIdx],
          from: orig === '' ? '(空字符串)' : orig,
          to: orig === '' ? '(空字符串)' : orig,
        }),
      ]

      const record: BoundaryRecord = {
        id,
        rowIndex: rowIdx,
        columnName: headers[colIdx],
        columnIndex: colIdx,
        currentValue: orig,
        originalValue: orig,
        correctedValue: '',
        denominatorColumnName: best.colName,
        denominatorColumnIndex: best.colIdx,
        denominatorValue: best.value,
        issueType: 'denominator_zero_empty',
        status: 'pending_review',
        reason,
        missingMaterial,
        nextAction: '找数据复核人',
        createdAt,
        history,
      }

      keyed.set(key, record)
      records.push(record)
    }
  }

  return records
}

export function reviewRecord(record: BoundaryRecord, role: '数据复核人' | '竞赛教练唐老师', note?: string): BoundaryRecord {
  const reviewedAt = now()
  const entry = makeHistory('复核', role, `复核确认：${note ?? '数据复核人已确认该异常条目，等待进一步修正或交由竞赛教练处理'}`)
  return {
    ...record,
    status: 'reviewed',
    reviewedBy: role,
    reviewedAt,
    nextAction: role === '数据复核人' ? '找竞赛教练唐老师' : record.nextAction,
    history: [...record.history, entry],
  }
}

export function resolveRecord(
  record: BoundaryRecord,
  role: '数据复核人' | '竞赛教练唐老师',
  correctedValue: string,
  resolvedReason: string
): BoundaryRecord {
  if (record.status !== 'reviewed') return record
  const resolvedAt = now()
  const entry = makeHistory('解决', role, `解决：${resolvedReason}`, {
    field: record.columnName,
    from: record.currentValue === '' ? '(空字符串)' : record.currentValue,
    to: correctedValue === '' ? '(空字符串)' : correctedValue,
  })
  return {
    ...record,
    status: 'resolved',
    correctedValue,
    resolvedReason,
    resolvedBy: role,
    resolvedAt,
    currentValue: correctedValue,
    history: [...record.history, entry],
  }
}
