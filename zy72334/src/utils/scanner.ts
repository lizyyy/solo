import type { BoundaryRecord } from '@/types'

export function scanBoundaryValues(
  headers: string[],
  rows: string[][],
  numericMatrix: number[][]
): BoundaryRecord[] {
  const records: BoundaryRecord[] = []

  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    for (let colIdx = 0; colIdx < headers.length; colIdx++) {
      const cellValue = rows[rowIdx][colIdx]
      if (cellValue === '' || cellValue === undefined || cellValue === null) {
        for (let denomCol = 0; denomCol < headers.length; denomCol++) {
          if (denomCol === colIdx) continue
          const denomVal = numericMatrix[rowIdx]?.[denomCol]
          if (denomVal === 0) {
            const id = `br-${rowIdx}-${colIdx}-${denomCol}`
            const existing = records.find(r => r.id === id)
            if (existing) continue

            records.push({
              id,
              rowIndex: rowIdx,
              columnName: headers[colIdx],
              currentValue: cellValue ?? '',
              denominatorColumnName: headers[denomCol],
              denominatorValue: 0,
              issueType: 'denominator_zero_empty',
              status: 'pending_review',
              reason: `第 ${rowIdx + 1} 行「${headers[colIdx]}」为空字符串，而分母列「${headers[denomCol]}」的值为 0。这意味着该比值无法计算，却未被标为异常，而是被空字符串静默填入。`,
              missingMaterial: `需要「${headers[denomCol]}」列的实际非零分母值，或确认「${headers[colIdx]}」应为 null 而非空字符串。`,
              nextAction: '找数据复核人',
            })
          }
        }
      }
    }
  }

  return records
}
