import type {
  SafetyRadiusRow,
  CoordinateOriginNote,
  MergedObstacle,
  SelfCheckIssue,
  SelfCheckType,
  ExportPayload,
  ExportItem,
  SelfCheckSummary,
} from '../types'

let issueCounter = 0
function nextIssueId(): string {
  issueCounter += 1
  return `issue_${issueCounter}`
}

export function mergeData(
  radiusRows: SafetyRadiusRow[],
  originNotes: CoordinateOriginNote[]
): MergedObstacle[] {
  const radiusMap = new Map<string, SafetyRadiusRow[]>()
  for (const row of radiusRows) {
    const list = radiusMap.get(row.obstacleId) ?? []
    list.push(row)
    radiusMap.set(row.obstacleId, list)
  }

  const originMap = new Map<string, CoordinateOriginNote[]>()
  for (const note of originNotes) {
    const list = originMap.get(note.obstacleId) ?? []
    list.push(note)
    originMap.set(note.obstacleId, list)
  }

  const allIds = new Set<string>([
    ...radiusMap.keys(),
    ...originMap.keys(),
  ])

  const results: MergedObstacle[] = []
  const now = Date.now()

  for (const id of allIds) {
    const rows = radiusMap.get(id) ?? []
    const notes = originMap.get(id) ?? []

    const namesFromRadiusTable = [...new Set(rows.map(r => r.obstacleName))]
    const namesFromOriginNote = [...new Set(notes.map(n => n.obstacleName))]
    const allNames = [...new Set([...namesFromRadiusTable, ...namesFromOriginNote])]

    const hasDuplicateName =
      namesFromRadiusTable.length > 1 ||
      namesFromOriginNote.length > 1 ||
      allNames.length > 1

    let duplicateNameDetail: string | null = null
    if (hasDuplicateName) {
      const parts: string[] = []
      if (namesFromRadiusTable.length > 1) {
        parts.push(`安全半径表内多个名称: ${namesFromRadiusTable.join(' / ')}`)
      }
      if (namesFromOriginNote.length > 1) {
        parts.push(`坐标原点说明内多个名称: ${namesFromOriginNote.join(' / ')}`)
      }
      if (namesFromRadiusTable.length === 1 && namesFromOriginNote.length === 1 && allNames.length > 1) {
        parts.push(`两源名称不一致: 安全半径表="${namesFromRadiusTable[0]}" vs 坐标原点说明="${namesFromOriginNote[0]}"`)
      }
      duplicateNameDetail = parts.join('; ')
    }

    const primaryRow = rows[0]
    const primaryNote = notes[0]

    const manualChanges = rows
      .filter(r => r.manualChange !== null)
      .map(r => ({
        originalRowNumber: r.originalRowNumber,
        field: 'radius',
        oldValue: '',
        newValue: r.manualChange!,
        changedAt: now,
      }))

    let status: MergedObstacle['status'] = 'pending_review'
    if (hasDuplicateName) {
      status = 'anomaly'
    } else if (rows.length > 0 && notes.length > 0) {
      status = 'pending_review'
    }

    let source: MergedObstacle['source'] = 'both'
    if (rows.length > 0 && notes.length === 0) source = 'radius_table'
    else if (rows.length === 0 && notes.length > 0) source = 'origin_note'

    results.push({
      obstacleId: id,
      namesFromRadiusTable,
      namesFromOriginNote,
      hasDuplicateName,
      duplicateNameDetail,
      radius: primaryRow?.radius ?? null,
      unit: primaryRow?.unit ?? 'm',
      originDescription: primaryNote?.originDescription ?? '',
      fieldObservation: primaryNote?.fieldObservation ?? '',
      originalRowNumbers: rows.map(r => r.originalRowNumber),
      manualChanges,
      status,
      source,
      createdAt: now,
      updatedAt: now,
    })
  }

  return results
}

export function runSelfChecks(
  radiusRows: SafetyRadiusRow[],
  originNotes: CoordinateOriginNote[],
  merged: MergedObstacle[]
): SelfCheckIssue[] {
  const issues: SelfCheckIssue[] = []

  checkDuplicateImport(radiusRows, originNotes, issues)
  checkDualName(merged, issues)
  checkRecalcConsistency(merged, issues)
  checkExportConsistency(merged, issues)

  return issues
}

function checkDuplicateImport(
  radiusRows: SafetyRadiusRow[],
  originNotes: CoordinateOriginNote[],
  issues: SelfCheckIssue[]
): void {
  const seen = new Map<string, { batch: string; count: number }>()

  for (const row of radiusRows) {
    const key = `${row.obstacleId}__${row.importBatch}`
    const existing = seen.get(key)
    if (existing) {
      existing.count += 1
    } else {
      seen.set(key, { batch: row.importBatch, count: 1 })
    }
  }

  for (const note of originNotes) {
    const key = `${note.obstacleId}__${note.importBatch}`
    const existing = seen.get(key)
    if (existing) {
      existing.count += 1
    } else {
      seen.set(key, { batch: note.importBatch, count: 1 })
    }
  }

  const batchRowCount = new Map<string, Map<string, number>>()
  for (const row of radiusRows) {
    const inner = batchRowCount.get(row.importBatch) ?? new Map()
    inner.set(row.obstacleId, (inner.get(row.obstacleId) ?? 0) + 1)
    batchRowCount.set(row.importBatch, inner)
  }

  for (const [_batch, idMap] of batchRowCount) {
    for (const [id, count] of idMap) {
      if (count > 1) {
        issues.push({
          id: nextIssueId(),
          type: 'duplicate_import',
          obstacleId: id,
          detail: `障碍物 ${id} 在同批次中出现了 ${count} 次，存在重复导入`,
          severity: 'error',
          resolved: false,
        })
      }
    }
  }
}

function checkDualName(merged: MergedObstacle[], issues: SelfCheckIssue[]): void {
  for (const item of merged) {
    if (item.hasDuplicateName) {
      issues.push({
        id: nextIssueId(),
        type: 'dual_name',
        obstacleId: item.obstacleId,
        detail: item.duplicateNameDetail ?? `障碍物 ${item.obstacleId} 存在名称不一致`,
        severity: 'warning',
        resolved: false,
      })
    }
  }
}

function checkRecalcConsistency(merged: MergedObstacle[], issues: SelfCheckIssue[]): void {
  for (const item of merged) {
    if (item.source === 'both' && item.radius !== null) {
      if (item.manualChanges.length > 0 && item.status !== 'confirmed') {
        const lastChange = item.manualChanges[item.manualChanges.length - 1]
        const recalcValue = parseFloat(lastChange.newValue)
        if (!isNaN(recalcValue) && Math.abs(recalcValue - item.radius) > 0.001) {
          issues.push({
            id: nextIssueId(),
            type: 'recalc_mismatch',
            obstacleId: item.obstacleId,
            detail: `障碍物 ${item.obstacleId} 补录后重算半径不一致: 原始=${item.radius}, 补录=${recalcValue}`,
            severity: 'error',
            resolved: false,
          })
        }
      }
    }
  }
}

function checkExportConsistency(merged: MergedObstacle[], issues: SelfCheckIssue[]): void {
  for (const item of merged) {
    const anomalyInMerge = item.hasDuplicateName
    const statusIsAnomaly = item.status === 'anomaly'
    if (anomalyInMerge !== statusIsAnomaly) {
      issues.push({
        id: nextIssueId(),
        type: 'export_inconsistency',
        obstacleId: item.obstacleId,
        detail: `障碍物 ${item.obstacleId} 异常标记与状态不一致: hasDuplicateName=${anomalyInMerge}, status=${item.status}`,
        severity: 'error',
        resolved: false,
      })
    }
  }
}

export function buildExportPayload(merged: MergedObstacle[], issues: SelfCheckIssue[]): ExportPayload {
  const items: ExportItem[] = merged.map(item => ({
    obstacleId: item.obstacleId,
    displayName: item.namesFromRadiusTable[0] ?? item.namesFromOriginNote[0] ?? item.obstacleId,
    radius: item.radius,
    unit: item.unit,
    status: item.status,
    originalRowNumbers: item.originalRowNumbers,
    hasAnomaly: item.hasDuplicateName,
    anomalyDetail: item.duplicateNameDetail,
  }))

  const anomalies = items.filter(i => i.hasAnomaly).length
  const totalChecks = issues.length
  const errors = issues.filter(i => i.severity === 'error').length
  const warnings = issues.filter(i => i.severity === 'warning').length
  const passed = totalChecks - errors - warnings

  const selfCheckSummary: SelfCheckSummary = {
    totalChecks,
    passed,
    warnings,
    errors,
  }

  return {
    generatedAt: Date.now(),
    totalObstacles: items.length,
    anomalies,
    items,
    selfCheckSummary,
  }
}

export function parseSafetyRadiusCSV(csv: string): SafetyRadiusRow[] {
  const lines = csv.trim().split('\n')
  if (lines.length < 2) return []

  const header = lines[0].split(',').map(h => h.trim())
  const rows: SafetyRadiusRow[] = []
  const batch = `batch_${Date.now()}`

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim())
    if (cols.length < 4) continue

    const obstacleId = cols[header.indexOf('obstacleId')] || cols[0]
    const obstacleName = cols[header.indexOf('obstacleName')] || cols[1]
    const radius = parseFloat(cols[header.indexOf('radius')] || cols[2])
    const unit = cols[header.indexOf('unit')] || cols[3] || 'm'
    const manualChange = cols[header.indexOf('manualChange')] || null

    rows.push({
      originalRowNumber: i + 1,
      obstacleId,
      obstacleName,
      radius: isNaN(radius) ? 0 : radius,
      unit,
      manualChange: manualChange === '' || manualChange === 'null' ? null : manualChange,
      status: 'pending',
      importBatch: batch,
    })
  }

  return rows
}

export function parseCoordinateOriginCSV(csv: string): CoordinateOriginNote[] {
  const lines = csv.trim().split('\n')
  if (lines.length < 2) return []

  const header = lines[0].split(',').map(h => h.trim())
  const notes: CoordinateOriginNote[] = []
  const batch = `batch_${Date.now()}`

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim())
    if (cols.length < 4) continue

    const obstacleId = cols[header.indexOf('obstacleId')] || cols[0]
    const obstacleName = cols[header.indexOf('obstacleName')] || cols[1]
    const originDescription = cols[header.indexOf('originDescription')] || cols[2]
    const fieldObservation = cols[header.indexOf('fieldObservation')] || cols[3]

    notes.push({
      noteId: `note_${i}`,
      obstacleId,
      obstacleName,
      originDescription,
      fieldObservation,
      importBatch: batch,
    })
  }

  return notes
}
