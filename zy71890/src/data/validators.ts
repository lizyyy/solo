import type { ConditionLog, ThresholdEvent, MaintenanceOrder, ValidationIssue, Attachment } from "@/types"

function checkLateAttachments(attachments: Attachment[], parentTimestamp: string, parentType: string, parentId: string): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const parentDate = new Date(parentTimestamp)
  for (const att of attachments) {
    if (att.isLate) {
      const attDate = new Date(att.uploadedAt)
      const diffDays = Math.ceil((attDate.getTime() - parentDate.getTime()) / (1000 * 60 * 60 * 24))
      issues.push({
        recordId: parentId,
        recordType: parentType as "condition" | "threshold" | "maintenance",
        issueType: "late_attachment",
        message: `附件「${att.fileName}」比${parentType === "condition" ? "工况日志" : parentType === "maintenance" ? "维修单" : "阈值记录"}晚了 ${diffDays} 天才上传，请确认是否漏传`,
      })
    }
  }
  return issues
}

function checkDuplicates(logs: ConditionLog[]): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const seen = new Map<string, ConditionLog>()
  for (const log of logs) {
    const key = `${log.timestamp}-${log.equipmentId}-${log.vibrationValue}`
    const existing = seen.get(key)
    if (existing) {
      issues.push({
        recordId: log.id,
        recordType: "condition",
        issueType: "duplicate",
        message: `这条振动记录（${log.vibrationValue}${log.unit}）与记录 ${existing.id} 的时间、设备、数值完全相同，疑似重复提交`,
      })
    } else {
      seen.set(key, log)
    }
  }
  return issues
}

function checkManualCorrections(logs: ConditionLog[], orders: MaintenanceOrder[]): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  for (const log of logs) {
    if (log.status === "manual_corrected" && log.correctionNote) {
      issues.push({
        recordId: log.id,
        recordType: "condition",
        issueType: "manual_correction",
        message: `这条记录已人工修正：${log.correctionNote}`,
      })
    }
  }
  for (const order of orders) {
    if (order.status === "manual_corrected") {
      issues.push({
        recordId: order.id,
        recordType: "maintenance",
        issueType: "manual_correction",
        message: `维修单「${order.faultDesc.slice(0, 20)}…」标记为人工修正，请核验修改内容`,
      })
    }
  }
  return issues
}

export function validateData(
  logs: ConditionLog[],
  events: ThresholdEvent[],
  orders: MaintenanceOrder[]
): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  for (const log of logs) {
    issues.push(...checkLateAttachments(log.attachments, log.timestamp, "condition", log.id))
  }
  for (const order of orders) {
    issues.push(...checkLateAttachments(order.attachments, order.createdAt, "maintenance", order.id))
  }

  issues.push(...checkDuplicates(logs))
  issues.push(...checkManualCorrections(logs, orders))

  const allIds = new Set([...logs.map(l => l.id), ...events.map(e => e.id), ...orders.map(o => o.id)])
  const issueIds = new Set(issues.map(i => i.recordId))
  for (const id of allIds) {
    if (!issueIds.has(id)) {
      const type = id.startsWith("cl") ? "condition" : id.startsWith("te") ? "threshold" : "maintenance"
      issues.push({
        recordId: id,
        recordType: type as "condition" | "threshold" | "maintenance",
        issueType: "normal",
        message: "记录正常，无异常",
      })
    }
  }

  return issues
}
