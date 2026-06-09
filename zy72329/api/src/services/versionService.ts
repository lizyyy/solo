import * as paramVersionRepo from '../repositories/paramVersionRepository'
import * as billRecordRepo from '../repositories/billRecordRepository'
import * as teacherNoteRepo from '../repositories/teacherNoteRepository'
import * as samplingListRepo from '../repositories/samplingListRepository'
import { create as createOperationHistory } from '../repositories/operationHistoryRepository'
import { generateNextVersion } from '../utils/versionGenerator'
import type { ParamVersion } from '../../../shared/types'

function getVersions(): ParamVersion[] {
  return paramVersionRepo.findAll()
}

function getVersion(id: string): ParamVersion {
  const version = paramVersionRepo.findById(id)
  if (!version) {
    throw new Error(`版本 ${id} 不存在`)
  }
  return version
}

function compareVersions(fromId: string, toId: string): { diffs: any[] } {
  const fromVersion = getVersion(fromId)
  const toVersion = getVersion(toId)

  const fromData = JSON.parse(fromVersion.snapshot)
  const toData = JSON.parse(toVersion.snapshot)

  const diffs: any[] = []

  const fromRecords = new Map(fromData.billRecords?.map((r: any) => [r.recordNo, r]) || [])
  const toRecords = new Map(toData.billRecords?.map((r: any) => [r.recordNo, r]) || [])

  for (const [recordNo, toRecord] of toRecords) {
    const fromRecord = fromRecords.get(recordNo)
    if (!fromRecord) {
      diffs.push({
        type: 'added',
        recordNo,
        from: null,
        to: toRecord,
      })
    } else if (JSON.stringify(fromRecord) !== JSON.stringify(toRecord)) {
      const fieldDiffs: any[] = []
      for (const key of Object.keys(toRecord)) {
        if (fromRecord[key] !== toRecord[key]) {
          fieldDiffs.push({
            field: key,
            from: fromRecord[key],
            to: toRecord[key],
          })
        }
      }
      if (fieldDiffs.length > 0) {
        diffs.push({
          type: 'modified',
          recordNo,
          fields: fieldDiffs,
        })
      }
    }
  }

  for (const [recordNo, fromRecord] of fromRecords) {
    if (!toRecords.has(recordNo)) {
      diffs.push({
        type: 'removed',
        recordNo,
        from: fromRecord,
        to: null,
      })
    }
  }

  if (JSON.stringify(fromVersion.recordCount) !== JSON.stringify(toVersion.recordCount)) {
    diffs.push({
      type: 'count_change',
      from: fromVersion.recordCount,
      to: toVersion.recordCount,
    })
  }

  return { diffs }
}

function createNewVersion(operator: string, operatorRole: string, changeSummary: string): ParamVersion {
  const latestVersion = paramVersionRepo.findLatest()
  const newVersionStr = latestVersion 
    ? generateNextVersion(latestVersion.version)
    : 'v1.0'

  const snapshot = JSON.stringify({
    teacherNotes: teacherNoteRepo.findAll(),
    samplingLists: samplingListRepo.findAll(),
    billRecords: billRecordRepo.findAll(),
    recordCounts: billRecordRepo.getRecordCounts(),
  })

  const recordCount = billRecordRepo.getRecordCounts()

  const newVersion = paramVersionRepo.create({
    version: newVersionStr,
    snapshot,
    changeSummary,
    operator,
    recordCount,
  })

  createOperationHistory({
    operationType: 'version_create',
    description: `创建参数版本 ${newVersionStr}：${changeSummary}`,
    operator,
    operatorRole,
  })

  return newVersion
}

export { getVersions, getVersion, compareVersions, createNewVersion }
