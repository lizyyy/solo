import * as paramVersionRepo from '../repositories/paramVersionRepository'
import * as billRecordRepo from '../repositories/billRecordRepository'
import * as teacherNoteRepo from '../repositories/teacherNoteRepository'
import * as samplingListRepo from '../repositories/samplingListRepository'
import { create as createOperationHistory } from '../repositories/operationHistoryRepository'
import { generateNextVersion } from '../utils/versionGenerator'
import type { ParamVersion, RecordStatus } from '../../../shared/types'

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

const FIELD_LABELS: Record<string, string> = {
  recordNo: '记录编号',
  date: '日期',
  teacherName: '老师姓名',
  amount: '金额',
  itemType: '项目类型',
  status: '状态',
  annotation: '批注内容',
  sceneDescription: '场景描述',
  rawTeacherNote: '老师批注原文',
  rawSampling: '抽样场景原文',
  missingRecordNo: '缺失编号',
  previousNo: '上一编号',
  nextNo: '下一编号',
  nextHandler: '下一步处理人',
  reason: '处理原因',
  reviewStatus: '复核状态',
  reviewNote: '复核意见',
  resolution: '冲突处理方案',
  resolutionNote: '处理说明',
}

const STATUS_LABELS: Record<string, string> = {
  smooth: '顺利',
  gap: '断档',
  supplement: '补录',
  conflict: '冲突',
  pending: '待处理',
  reviewed_normal: '复核正常',
  reviewed_abnormal: '复核异常',
  approved: '已通过',
  rejected: '已驳回',
}

interface RecordChange {
  recordNo: string;
  changeType: 'added' | 'removed' | 'modified';
  beforeStatus?: string;
  afterStatus?: string;
  beforeStatusLabel?: string;
  afterStatusLabel?: string;
  fieldChanges: Array<{
    field: string;
    fieldLabel: string;
    before: string | number;
    after: string | number;
  }>;
}

interface CountChangeItem {
  before: number;
  after: number;
  diff: number;
}

interface VersionComparisonResult {
  fromVersion: string;
  toVersion: string;
  fromVersionId: string;
  toVersionId: string;
  fromCreatedAt: string;
  toCreatedAt: string;
  fromOperator: string;
  toOperator: string;
  fromChangeSummary: string;
  toChangeSummary: string;
  summary: {
    added: number;
    removed: number;
    modified: number;
    unchanged: number;
    totalBefore: number;
    totalAfter: number;
  };
  countChanges: Record<RecordStatus | string, CountChangeItem>;
  recordChanges: RecordChange[];
}

function compareVersions(fromVersionStr: string, toVersionStr: string): VersionComparisonResult {
  const fromVersion = paramVersionRepo.findByVersion(fromVersionStr)
  const toVersion = paramVersionRepo.findByVersion(toVersionStr)

  if (!fromVersion) {
    throw new Error(`版本 ${fromVersionStr} 不存在`)
  }
  if (!toVersion) {
    throw new Error(`版本 ${toVersionStr} 不存在`)
  }

  const fromData = JSON.parse(fromVersion.snapshot)
  const toData = JSON.parse(toVersion.snapshot)

  const fromRecords = new Map(fromData.billRecords?.map((r: any) => [r.recordNo, r]) || [])
  const toRecords = new Map(toData.billRecords?.map((r: any) => [r.recordNo, r]) || [])

  const recordChanges: RecordChange[] = []
  let addedCount = 0
  let removedCount = 0
  let modifiedCount = 0

  for (const [recordNo, toRecord] of toRecords) {
    const fromRecord = fromRecords.get(recordNo)
    if (!fromRecord) {
      addedCount++
      recordChanges.push({
        recordNo,
        changeType: 'added',
        afterStatus: toRecord.status,
        afterStatusLabel: STATUS_LABELS[toRecord.status] || toRecord.status,
        fieldChanges: Object.keys(toRecord).map((key) => ({
          field: key,
          fieldLabel: FIELD_LABELS[key] || key,
          before: '-',
          after: toRecord[key] ?? '-',
        })),
      })
    } else {
      const fieldChanges: RecordChange['fieldChanges'] = []
      for (const key of Object.keys(toRecord)) {
        const fromVal = fromRecord[key]
        const toVal = toRecord[key]
        if (JSON.stringify(fromVal) !== JSON.stringify(toVal)) {
          fieldChanges.push({
            field: key,
            fieldLabel: FIELD_LABELS[key] || key,
            before: fromVal ?? '-',
            after: toVal ?? '-',
          })
        }
      }
      if (fieldChanges.length > 0) {
        modifiedCount++
        recordChanges.push({
          recordNo,
          changeType: 'modified',
          beforeStatus: fromRecord.status,
          beforeStatusLabel: STATUS_LABELS[fromRecord.status] || fromRecord.status,
          afterStatus: toRecord.status,
          afterStatusLabel: STATUS_LABELS[toRecord.status] || toRecord.status,
          fieldChanges,
        })
      }
    }
  }

  for (const [recordNo, fromRecord] of fromRecords) {
    if (!toRecords.has(recordNo)) {
      removedCount++
      recordChanges.push({
        recordNo,
        changeType: 'removed',
        beforeStatus: fromRecord.status,
        beforeStatusLabel: STATUS_LABELS[fromRecord.status] || fromRecord.status,
        fieldChanges: Object.keys(fromRecord).map((key) => ({
          field: key,
          fieldLabel: FIELD_LABELS[key] || key,
          before: fromRecord[key] ?? '-',
          after: '-',
        })),
      })
    }
  }

  const countChanges: Record<string, CountChangeItem> = {}
  const statusKeys: RecordStatus[] = ['smooth', 'gap', 'supplement', 'conflict', 'pending', 'reviewed_normal', 'reviewed_abnormal']
  for (const key of statusKeys) {
    const before = fromVersion.recordCount[key as keyof typeof fromVersion.recordCount] || 0
    const after = toVersion.recordCount[key as keyof typeof toVersion.recordCount] || 0
    countChanges[key] = {
      before,
      after,
      diff: after - before,
    }
  }

  const totalBefore = fromRecords.size
  const totalAfter = toRecords.size
  const unchanged = totalBefore - removedCount - modifiedCount

  return {
    fromVersion: fromVersion.version,
    toVersion: toVersion.version,
    fromVersionId: fromVersion.id,
    toVersionId: toVersion.id,
    fromCreatedAt: fromVersion.createdAt,
    toCreatedAt: toVersion.createdAt,
    fromOperator: fromVersion.operator,
    toOperator: toVersion.operator,
    fromChangeSummary: fromVersion.changeSummary,
    toChangeSummary: toVersion.changeSummary,
    summary: {
      added: addedCount,
      removed: removedCount,
      modified: modifiedCount,
      unchanged,
      totalBefore,
      totalAfter,
    },
    countChanges,
    recordChanges,
  }
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
