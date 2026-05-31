import type { RehearsalRecord, VersionDiff } from './types.js'

type RecordMap = Map<string, RehearsalRecord>

export class VersionTracker {
  private history: Map<string, RehearsalRecord[]> = new Map()

  ingest(records: RehearsalRecord[]): VersionDiff[] {
    const diffs: VersionDiff[] = []

    for (const record of records) {
      if (!record.previousVersionId) continue

      const previousRecords = this.history.get(record.previousVersionId)
      if (!previousRecords || previousRecords.length === 0) {
        diffs.push({
          previousVersionId: record.previousVersionId,
          previousVersion: 0,
          currentVersion: record.version,
          changedFields: ['__unknown_previous__'],
          summary: `记录"${record.id}"引用了前一版本"${record.previousVersionId}"，但该版本在已有历史中未找到。可能是补传的旧版本数据。`,
          noteAboutOldVersion: true,
        })
        continue
      }

      const previousRecord = previousRecords[previousRecords.length - 1]

      if (record.version <= previousRecord.version) {
        const diff = this.computeDiff(previousRecord, record)
        diff.noteAboutOldVersion = true
        diff.summary =
          `⚠️ 补传提醒：记录"${record.id}"的版本号（v${record.version}）不高于已有版本（v${previousRecord.version}），疑似补传旧版本。` +
          (diff.changedFields.length > 0
            ? `变更字段：${diff.changedFields.join('、')}。` +
              diff.summary
            : '无字段变更，但版本号未递增。')
        diffs.push(diff)
        continue
      }

      const diff = this.computeDiff(previousRecord, record)
      diffs.push(diff)
    }

    for (const record of records) {
      const existing = this.history.get(record.id) ?? []
      existing.push(record)
      this.history.set(record.id, existing)
    }

    return diffs
  }

  getHistory(recordId: string): RehearsalRecord[] {
    return this.history.get(recordId) ?? []
  }

  private computeDiff(
    previous: RehearsalRecord,
    current: RehearsalRecord
  ): VersionDiff {
    const changedFields: string[] = []

    const fieldComparisons: [string, (r: RehearsalRecord) => unknown][] = [
      ['studentName', (r) => r.studentName],
      ['measureRange', (r) => r.measureRange.join('-')],
      ['keySignature', (r) => r.keySignature],
      ['partName', (r) => r.partName],
      ['note', (r) => r.note ?? ''],
      ['isManualCorrection', (r) => r.isManualCorrection],
    ]

    for (const [fieldName, getter] of fieldComparisons) {
      if (getter(previous) !== getter(current)) {
        changedFields.push(fieldName)
      }
    }

    const fieldChanges = changedFields
      .map((f) => {
        const oldVal = this.getFieldValue(previous, f)
        const newVal = this.getFieldValue(current, f)
        return `${f}："${oldVal}"→"${newVal}"`
      })
      .join('；')

    return {
      previousVersionId: previous.id,
      previousVersion: previous.version,
      currentVersion: current.version,
      changedFields,
      summary:
        changedFields.length > 0
          ? `记录"${current.id}"从v${previous.version}更新至v${current.version}，变更内容：${fieldChanges}。`
          : `记录"${current.id}"从v${previous.version}更新至v${current.version}，无明显字段变更。`,
      noteAboutOldVersion: false,
    }
  }

  private getFieldValue(record: RehearsalRecord, field: string): string {
    switch (field) {
      case 'studentName':
        return record.studentName
      case 'measureRange':
        return record.measureRange.join('-')
      case 'keySignature':
        return record.keySignature
      case 'partName':
        return record.partName
      case 'note':
        return record.note ?? ''
      case 'isManualCorrection':
        return String(record.isManualCorrection)
      default:
        return ''
    }
  }
}
