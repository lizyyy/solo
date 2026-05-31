import type { FontRecord, ImportRow, ConflictItem, LicenseType } from '@/types'

export function buildDuplicateKey(partial: { fontName: string; licenseType?: LicenseType | string; colorCardVersion?: string }): string {
  return `${partial.fontName}::${partial.licenseType || ''}::${partial.colorCardVersion || ''}`
}

export function detectDuplicates(
  importRows: ImportRow[],
  existing: FontRecord[]
): { existingMap: Map<string, FontRecord>; conflicts: ConflictItem[] } {
  const existingMap = new Map<string, FontRecord>()
  for (const r of existing) {
    existingMap.set(buildDuplicateKey(r), r)
  }

  const conflicts: ConflictItem[] = []
  for (let i = 0; i < importRows.length; i++) {
    const row = importRows[i]
    const key = buildDuplicateKey({
      fontName: row.fontName,
      licenseType: row.licenseType,
      colorCardVersion: row.colorCardVersion,
    })
    const match = existingMap.get(key)
    if (match) {
      conflicts.push({
        importRow: row,
        existingRecord: match,
        index: i,
      })
    }
  }

  return { existingMap, conflicts }
}
