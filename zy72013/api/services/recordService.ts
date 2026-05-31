import * as recordRepo from '../repositories/recordRepository.js'
import * as auditLogRepo from '../repositories/auditLogRepository.js'
import * as attachmentRepo from '../repositories/attachmentRepository.js'
import { STATUS_LABELS } from '../../shared/types.js'
import type { RecordStatus, DepositRecord, AuditLog, Attachment, RecordSummary, RecordsResponse, RecordDetailResponse, SupplementResponse } from '../../shared/types.js'

interface ListFilters {
  status?: string
  min_amount?: number
  max_amount?: number
  start_date?: string
  end_date?: string
  keyword?: string
}

export function listRecords(filters: ListFilters): RecordsResponse {
  const result = recordRepo.findAll(filters)
  return { data: result.records, summary: result.summary }
}

export function getRecordDetail(id: string): RecordDetailResponse | null {
  const record = recordRepo.findById(id)
  if (!record) return null

  const attachments = attachmentRepo.findByRecordId(id)
  const audit_logs = auditLogRepo.findByRecordId(id)

  return { data: record, attachments, audit_logs }
}

export function createRecord(data: { unit_name: string; amount: number; deposit_type?: string; status?: RecordStatus; source?: string; original_remark?: string }): DepositRecord {
  return recordRepo.create({
    unit_name: data.unit_name,
    amount: data.amount,
    deposit_type: data.deposit_type || '租赁保证金',
    status: data.status || 'pending',
    source: data.source || '',
    original_remark: data.original_remark || '',
  })
}

export function rejudgeRecord(id: string, params: { new_status: RecordStatus; reason: string }): DepositRecord | null {
  const record = recordRepo.findById(id)
  if (!record) return null

  const oldStatus = record.status
  recordRepo.updateStatus(id, params.new_status)

  auditLogRepo.create({
    record_id: id,
    action: 'rejudge',
    old_status: oldStatus,
    new_status: params.new_status,
    reason: params.reason,
    diff_summary: `状态变更: ${STATUS_LABELS[oldStatus as RecordStatus] || oldStatus} → ${STATUS_LABELS[params.new_status] || params.new_status}`,
  })

  return recordRepo.findById(id)!
}

export function rollbackRecord(id: string, params: { reason: string }): DepositRecord | null {
  const record = recordRepo.findById(id)
  if (!record) return null

  const lastLog = auditLogRepo.findLastByRecordId(id)
  if (!lastLog) return null

  const targetStatus = lastLog.old_status
  if (!targetStatus) return null

  const currentStatus = record.status
  recordRepo.updateStatus(id, targetStatus)

  auditLogRepo.create({
    record_id: id,
    action: 'rollback',
    old_status: currentStatus,
    new_status: targetStatus,
    reason: params.reason,
    diff_summary: `回滚操作: ${STATUS_LABELS[currentStatus as RecordStatus] || currentStatus} → ${STATUS_LABELS[targetStatus as RecordStatus] || targetStatus}，回退自操作[${lastLog.action}]`,
  })

  return recordRepo.findById(id)!
}

export function supplementRecord(id: string, params: { remark: string }): SupplementResponse | null {
  const record = recordRepo.findById(id)
  if (!record) return null

  const beforeRemark = record.original_remark
  const afterRemark = beforeRemark ? `${beforeRemark}\n${params.remark}` : params.remark

  recordRepo.updateRemark(id, afterRemark)

  const auditLog = auditLogRepo.create({
    record_id: id,
    action: 'supplement',
    old_status: record.status,
    new_status: record.status,
    reason: '补充备注',
    diff_summary: `追加备注: "${params.remark}"`,
  })

  const updatedRecord = recordRepo.findById(id)!

  return {
    data: updatedRecord,
    audit_log: auditLog,
    diff: {
      before: beforeRemark,
      after: afterRemark,
      summary: `追加备注: "${params.remark}"`,
    },
  }
}

export function exportRecords(filters: ListFilters): DepositRecord[] {
  const result = recordRepo.findAll(filters)
  return result.records
}
