import { Router, type Request, type Response } from "express"
import db from "../db.js"
import { evaluateDirection } from "../direction-rules.js"

const router = Router()

function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
}

function mapRow(row: Record<string, unknown>): Record<string, unknown> {
  const mapped: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    mapped[toCamelCase(key)] = value
  }
  return mapped
}

function getAnomalyReason(direction: string, directionStatus: string): string {
  if (directionStatus !== "abnormal") return ""
  const { reason } = evaluateDirection(direction)
  if (reason.includes("口语化") || reason.includes("未识别") || reason.includes("为空")) {
    return "方向无效（口语化表达或未识别）"
  }
  return reason
}

interface SummaryQueryRow {
  status: string
  count: number
}

router.get("/summary", (_req: Request, res: Response): void => {
  try {
    const rows = db
      .prepare(
        `SELECT status, COUNT(*) as count
         FROM calibration_records
         WHERE direction_status = 'abnormal'
         GROUP BY status`
      )
      .all() as SummaryQueryRow[]

    const result = { pending: 0, confirmed: 0, rolledBack: 0 }
    for (const row of rows) {
      if (row.status === "imported" || row.status === "reviewed") {
        result.pending += row.count
      } else if (row.status === "confirmed") {
        result.confirmed += row.count
      } else if (row.status === "rolled_back") {
        result.rolledBack += row.count
      }
    }

    res.json(result)
  } catch (error) {
    res.status(500).json({ success: false, error: "Query summary failed" })
  }
})

interface RecordsQuery {
  page?: string
  pageSize?: string
  status?: string
  sensorId?: string
  directionStatus?: string
  includeAll?: string
}

router.get("/records", (req: Request<unknown, unknown, unknown, RecordsQuery>, res: Response): void => {
  try {
    const { status, sensorId, page = "1", pageSize = "20", directionStatus, includeAll } = req.query

    const hasAbnormalAudit = includeAll === "1"
    let where = hasAbnormalAudit
      ? "WHERE EXISTS (SELECT 1 FROM audit_logs al WHERE al.record_id = calibration_records.id) OR direction_status = 'abnormal'"
      : "WHERE direction_status = 'abnormal'"
    const params: unknown[] = []

    if (directionStatus) {
      where += " AND direction_status = ?"
      params.push(directionStatus)
    }
    if (status) {
      if (status === "pending") {
        where += " AND status IN ('imported', 'reviewed')"
      } else {
        where += " AND status = ?"
        params.push(status)
      }
    }
    if (sensorId) {
      where += " AND sensor_id LIKE ?"
      params.push(`%${sensorId}%`)
    }

    const totalRow = db
      .prepare(`SELECT COUNT(*) as count FROM calibration_records ${where}`)
      .get(...params) as { count: number }
    const total = totalRow.count

    const pageNum = Math.max(1, Number(page))
    const pageSizeNum = Math.max(1, Number(pageSize))
    const offset = (pageNum - 1) * pageSizeNum

    const rows = db
      .prepare(
        `SELECT * FROM calibration_records ${where}
         ORDER BY id DESC
         LIMIT ? OFFSET ?`
      )
      .all(...params, pageSizeNum, offset) as Record<string, unknown>[]

    const recordIds = rows.map((r) => r.id)
    const auditCounts: Record<number, number> = {}
    if (recordIds.length > 0) {
      const placeholders = recordIds.map(() => "?").join(",")
      const aRows = db
        .prepare(
          `SELECT record_id, COUNT(*) as cnt
           FROM audit_logs WHERE record_id IN (${placeholders}) GROUP BY record_id`
        )
        .all(...recordIds) as { record_id: number; cnt: number }[]
      for (const a of aRows) auditCounts[a.record_id] = a.cnt
    }

    const data = rows.map((r) => {
      const mapped = mapRow(r)
      mapped.anomalyReason = getAnomalyReason(
        String(r.direction ?? ""),
        String(r.direction_status ?? "")
      )
      mapped.auditCount = auditCounts[Number(r.id)] ?? 0
      return mapped
    })

    res.json({ success: true, total, page: pageNum, pageSize: pageSizeNum, data })
  } catch (error) {
    res.status(500).json({ success: false, error: "Query records failed" })
  }
})

interface ConfirmBody {
  changedBy?: string
  role?: string
  reason?: string
  confirmedBy?: string
}

router.patch(
  "/records/:id/confirm",
  (req: Request<{ id: string }, unknown, ConfirmBody>, res: Response): void => {
    try {
      const { id } = req.params
      const { changedBy, role, reason, confirmedBy } = req.body

      const finalChangedBy = changedBy || confirmedBy
      let finalRole = role || "lab_teacher"
      if (finalRole === "teacher") finalRole = "lab_teacher"

      if (!finalChangedBy || !finalRole || !reason) {
        res.status(400).json({ success: false, error: "缺少必填字段: changedBy / reason" })
        return
      }

      const record = db
        .prepare("SELECT * FROM calibration_records WHERE id = ?")
        .get(id) as Record<string, unknown> | undefined
      if (!record) {
        res.status(404).json({ success: false, error: "记录不存在" })
        return
      }

      if (record.direction_status !== "abnormal") {
        res.status(400).json({
          success: false,
          error: `记录不是异常方向(当前=${record.direction_status}), 无法进入复核确认`,
        })
        return
      }

      db.transaction(() => {
        db.prepare(
          `UPDATE calibration_records
           SET status = 'confirmed', updated_at = datetime('now')
           WHERE id = ?`
        ).run(id)

        db.prepare(
          `INSERT INTO audit_logs (record_id, field_name, old_value, new_value, changed_by, role, reason)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(
          Number(id),
          "status",
          String(record.status ?? ""),
          "confirmed",
          finalChangedBy,
          finalRole,
          reason
        )
      })()

      const updated = db
        .prepare("SELECT * FROM calibration_records WHERE id = ?")
        .get(id) as Record<string, unknown>
      res.json({ success: true, data: mapRow(updated) })
    } catch (error) {
      res.status(500).json({ success: false, error: "Confirm failed: " + String(error) })
    }
  }
)

interface RollbackBody {
  changedBy?: string
  role?: string
  reason?: string
  newValue?: string
  rolledBackBy?: string
}

router.patch(
  "/records/:id/rollback",
  (req: Request<{ id: string }, unknown, RollbackBody>, res: Response): void => {
    try {
      const { id } = req.params
      const { changedBy, role, reason, newValue, rolledBackBy } = req.body

      const finalChangedBy = changedBy || rolledBackBy
      let finalRole = role || "lab_teacher"
      if (finalRole === "teacher") finalRole = "lab_teacher"

      if (!finalChangedBy || !finalRole || !reason) {
        res.status(400).json({ success: false, error: "缺少必填字段: changedBy / reason" })
        return
      }

      const record = db
        .prepare("SELECT * FROM calibration_records WHERE id = ?")
        .get(id) as Record<string, unknown> | undefined
      if (!record) {
        res.status(404).json({ success: false, error: "记录不存在" })
        return
      }

      if (record.direction_status !== "abnormal") {
        res.status(400).json({
          success: false,
          error: `记录不是异常方向(当前=${record.direction_status}), 仅异常方向可通过此接口回滚`,
        })
        return
      }

      const oldDirection = String(record.direction ?? "")
      const newDirection = newValue ?? oldDirection
      const { normalizedValue, status: newDirectionStatus } = evaluateDirection(newDirection)

      db.transaction(() => {
        db.prepare(
          `UPDATE calibration_records
           SET direction = ?, direction_normalized = ?, direction_status = ?,
               status = 'rolled_back', updated_at = datetime('now')
           WHERE id = ?`
        ).run(newDirection, normalizedValue, newDirectionStatus, id)

        db.prepare(
          `INSERT INTO audit_logs (record_id, field_name, old_value, new_value, changed_by, role, reason)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(
          Number(id),
          "direction",
          oldDirection,
          newDirection,
          finalChangedBy,
          finalRole,
          reason
        )
      })()

      const updated = db
        .prepare("SELECT * FROM calibration_records WHERE id = ?")
        .get(id) as Record<string, unknown>
      res.json({ success: true, data: mapRow(updated) })
    } catch (error) {
      res.status(500).json({ success: false, error: "Rollback failed: " + String(error) })
    }
  }
)

function csvEscape(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value)
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

interface AuditLogRow {
  id: number
  record_id: number
  field_name: string
  old_value: string
  new_value: string
  changed_by: string
  role: string
  reason: string
  created_at: string
}

router.get("/export", (_req: Request, res: Response): void => {
  try {
    const rows = db
      .prepare(
        `SELECT * FROM calibration_records
         WHERE direction_status = 'abnormal'
            OR EXISTS (SELECT 1 FROM audit_logs al WHERE al.record_id = calibration_records.id)
         ORDER BY id ASC`
      )
      .all() as Record<string, unknown>[]

    const recordIds = rows.map((r) => r.id)
    const auditCountsMap = new Map<number, number>()
    const latestRollbackMap = new Map<number, AuditLogRow>()
    const auditByRecord = new Map<number, AuditLogRow[]>()
    const firstDirectionMap = new Map<number, string>()

    if (recordIds.length > 0) {
      const placeholders = recordIds.map(() => "?").join(",")

      const auditRows = db
        .prepare(
          `SELECT record_id, COUNT(*) as count
           FROM audit_logs
           WHERE record_id IN (${placeholders})
           GROUP BY record_id`
        )
        .all(...recordIds) as { record_id: number; count: number }[]
      for (const ar of auditRows) {
        auditCountsMap.set(ar.record_id, ar.count)
      }

      const allAuditLogsAsc = db
        .prepare(
          `SELECT * FROM audit_logs
           WHERE record_id IN (${placeholders})
           ORDER BY created_at ASC, id ASC`
        )
        .all(...recordIds) as AuditLogRow[]

      for (const log of allAuditLogsAsc) {
        const arr = auditByRecord.get(log.record_id) ?? []
        arr.push(log)
        auditByRecord.set(log.record_id, arr)

        if (log.field_name === "direction" && !firstDirectionMap.has(log.record_id)) {
          firstDirectionMap.set(log.record_id, log.old_value)
        }
      }

      for (const [rid, logs] of auditByRecord) {
        for (let i = logs.length - 1; i >= 0; i--) {
          if (logs[i].field_name === "direction") {
            latestRollbackMap.set(rid, logs[i])
            break
          }
        }
      }
    }

    const headers = [
      "记录ID",
      "原始行号",
      "传感器编号",
      "温度(°C)",
      "当前方向值",
      "原始方向值(导入时/首次改动前)",
      "标准化方向值",
      "方向状态",
      "处理状态",
      "触发异常原因",
      "审计日志条数",
      "最近回滚-改前值",
      "最近回滚-改后值",
      "最近回滚-原因",
      "最近回滚-处理人",
      "是否含临时补材料痕迹",
      "是否含向左痕迹",
      "创建时间",
      "最后更新时间",
    ]

    const csvLines: string[] = [headers.join(",")]

    for (const row of rows) {
      const recordId = Number(row.id)
      const auditCount = auditCountsMap.get(recordId) ?? 0
      const latestRollback = latestRollbackMap.get(recordId)
      const recordLogs = auditByRecord.get(recordId) ?? []

      const firstDirection = firstDirectionMap.get(recordId) ?? String(row.direction ?? "")

      let hasTempMat = false
      let hasLeftTrace = false
      const curDirection = String(row.direction ?? "")
      if (/向左|左|left|临时补材料|补录|补看|B-|临时加材料/i.test(
        String(row.sensor_id ?? "") + "|" + curDirection
      )) {
        if (/向左|左|left/i.test(curDirection) || /向左|左|left/i.test(firstDirection)) hasLeftTrace = true
        if (/临时补材料|补录|补看|B-|临时加材料/i.test(String(row.sensor_id ?? ""))) hasTempMat = true
      }
      for (const l of recordLogs) {
        const hay = (l.old_value ?? "") + "|" + (l.new_value ?? "") + "|" + (l.reason ?? "")
        if (/临时补材料|补录|补看|B-|临时加材料/i.test(hay)) hasTempMat = true
        if (/向左|左|left/i.test(hay)) hasLeftTrace = true
      }

      const lineFields = [
        csvEscape(row.id),
        csvEscape(row.original_line_number),
        csvEscape(row.sensor_id),
        csvEscape(Number(row.temperature ?? 0).toFixed(2)),
        csvEscape(row.direction),
        csvEscape(firstDirection),
        csvEscape(row.direction_normalized ?? ""),
        csvEscape(row.direction_status),
        csvEscape(row.status),
        csvEscape(
          getAnomalyReason(
            firstDirection,
            String(row.direction_status === "abnormal" ? "abnormal" : "")
          )
        ),
        csvEscape(auditCount),
        csvEscape(latestRollback?.old_value ?? ""),
        csvEscape(latestRollback?.new_value ?? ""),
        csvEscape(latestRollback?.reason ?? ""),
        csvEscape(latestRollback?.changed_by ?? ""),
        csvEscape(hasTempMat ? "是" : ""),
        csvEscape(hasLeftTrace ? "是" : ""),
        csvEscape(row.created_at ?? ""),
        csvEscape(row.updated_at ?? ""),
      ]
      csvLines.push(lineFields.join(","))

      if (recordLogs.length > 0) {
        for (const log of recordLogs) {
          const trace = [
            "",
            "",
            "",
            "",
            `【审计子行】${log.field_name}`,
            "",
            "",
            "",
            "",
            csvEscape(log.reason),
            csvEscape(log.changed_by),
            csvEscape(log.old_value),
            csvEscape(log.new_value),
            csvEscape(log.reason),
            csvEscape(log.changed_by + "(" + log.role + ")"),
            /临时补材料|补录|补看|B-|临时加材料/i.test(log.reason + "|" + log.old_value + "|" + log.new_value) ? "是" : "",
            /向左|左|left/i.test(log.old_value + "|" + log.new_value + "|" + log.reason) ? "是" : "",
            csvEscape(log.created_at),
            "",
          ]
          csvLines.push(trace.join(","))
        }
      }
    }

    const csvContent = "\uFEFF" + csvLines.join("\n")

    res.setHeader("Content-Type", "text/csv; charset=utf-8")
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="fridge_door_seal_calibration_${Date.now()}.csv"`
    )
    res.send(csvContent)
  } catch (error) {
    res.status(500).json({ success: false, error: "Export failed: " + String(error) })
  }
})

export default router
