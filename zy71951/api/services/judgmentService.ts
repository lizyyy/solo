import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../database.js'
import { logAuditEvent } from './auditService.js'
import type { Judgment, JudgmentRow, JudgeRequest, JudgeResponse, RecordStatus, RuleType, Severity } from '../types.js'

const NO_FLY_ZONES = [
  { name: '机场禁飞区A', centerLat: 30.572, centerLng: 104.066, radiusKm: 5 },
  { name: '军事禁区B', centerLat: 31.230, centerLng: 121.473, radiusKm: 8 },
  { name: '政府禁飞区C', centerLat: 39.904, centerLng: 116.407, radiusKm: 3 },
]

function rowToJudgment(row: JudgmentRow): Judgment {
  return {
    id: row.id,
    recordId: row.record_id,
    ruleName: row.rule_name,
    ruleType: row.rule_type,
    triggeredAt: row.triggered_at,
    matchedData: JSON.parse(row.matched_data || '{}'),
    conclusion: row.conclusion,
    reasoning: row.reasoning,
    suggestedAction: row.suggested_action,
    severity: row.severity,
    confirmed: row.confirmed === 1,
    confirmedBy: row.confirmed_by ?? undefined,
    confirmedAt: row.confirmed_at ?? undefined,
  }
}

function checkNoFlyZone(flightData: Record<string, unknown>): Judgment | null {
  const lat = flightData.latitude as number | undefined
  const lng = flightData.longitude as number | undefined
  if (lat == null || lng == null) return null

  for (const zone of NO_FLY_ZONES) {
    const distance = haversineKm(lat, lng, zone.centerLat, zone.centerLng)
    if (distance <= zone.radiusKm * 1.2 && distance > zone.radiusKm) {
      return {
        id: uuidv4(),
        recordId: '',
        ruleName: '禁飞区擦边检测',
        ruleType: 'no_fly_zone',
        triggeredAt: new Date().toISOString(),
        matchedData: { zone: zone.name, distanceKm: Math.round(distance * 100) / 100, zoneRadiusKm: zone.radiusKm, flightLat: lat, flightLng: lng },
        conclusion: `飞行路径距${zone.name}边缘仅${Math.round((distance - zone.radiusKm) * 100) / 100}km，属于禁飞区擦边飞行`,
        reasoning: `无人机飞行坐标(${lat},${lng})距${zone.name}中心${Math.round(distance * 100) / 100}km，禁飞区半径${zone.radiusKm}km，距边界仅${Math.round((distance - zone.radiusKm) * 100) / 100}km，处于1.2倍警戒范围内，存在误入禁飞区风险`,
        suggestedAction: '建议外场队长核实飞行航线是否获得禁飞区边缘飞行许可，若无许可需立即调整后续飞行计划，并在记录中补充飞行豁免证明',
        severity: 'warning',
        confirmed: false,
      }
    }
    if (distance <= zone.radiusKm) {
      return {
        id: uuidv4(),
        recordId: '',
        ruleName: '禁飞区侵入检测',
        ruleType: 'no_fly_zone',
        triggeredAt: new Date().toISOString(),
        matchedData: { zone: zone.name, distanceKm: Math.round(distance * 100) / 100, zoneRadiusKm: zone.radiusKm, flightLat: lat, flightLng: lng },
        conclusion: `飞行路径已进入${zone.name}禁飞区内部，属于严重违规飞行`,
        reasoning: `无人机飞行坐标(${lat},${lng})距${zone.name}中心仅${Math.round(distance * 100) / 100}km，小于禁飞区半径${zone.radiusKm}km，已明确侵入禁飞区，违反无人机飞行管理规定`,
        suggestedAction: '立即报告项目负责人和安全管理部门，暂停该飞行员后续飞行任务，提交违规飞行说明和整改方案，记录必须附上违规处理决定文件',
        severity: 'critical',
        confirmed: false,
      }
    }
  }
  return null
}

function checkDataIntegrity(flightData: Record<string, unknown>): Judgment | null {
  const missingFields: string[] = []
  const requiredFields = ['latitude', 'longitude', 'altitude', 'batteryLevel', 'flightDuration']

  for (const field of requiredFields) {
    if (flightData[field] == null || flightData[field] === '') {
      missingFields.push(field)
    }
  }

  if (missingFields.length > 0) {
    return {
      id: uuidv4(),
      recordId: '',
      ruleName: '数据完整性校验',
      ruleType: 'data_integrity',
      triggeredAt: new Date().toISOString(),
      matchedData: { missingFields, providedFields: Object.keys(flightData) },
      conclusion: `巡检数据缺失${missingFields.length}个必填字段：${missingFields.join('、')}`,
      reasoning: `巡检记录缺少关键字段${missingFields.join('、')}，这些字段是飞行安全分析和数据追溯的必要信息，缺失将导致无法完整还原飞行状态和进行后续质量评估`,
      suggestedAction: '联系外场队长补充缺失数据，或确认该飞行是否存在设备故障导致数据未记录，在数据补齐前该记录应标记为待补充状态',
      severity: missingFields.length >= 3 ? 'critical' : 'warning',
      confirmed: false,
    }
  }
  return null
}

function checkAnomalies(flightData: Record<string, unknown>): Judgment | null {
  const anomalies: string[] = []
  const matchedData: Record<string, unknown> = {}

  const altitude = flightData.altitude as number | undefined
  const batteryLevel = flightData.batteryLevel as number | undefined
  const flightDuration = flightData.flightDuration as number | undefined
  const windSpeed = flightData.windSpeed as number | undefined

  if (altitude != null && altitude > 500) {
    anomalies.push('飞行高度超标')
    matchedData.altitude = altitude
    matchedData.altitudeLimit = 500
  }

  if (batteryLevel != null && batteryLevel < 15) {
    anomalies.push('电池电量严重不足')
    matchedData.batteryLevel = batteryLevel
    matchedData.batteryThreshold = 15
  }

  if (flightDuration != null && flightDuration > 60) {
    anomalies.push('飞行时长异常')
    matchedData.flightDuration = flightDuration
    matchedData.durationLimit = 60
  }

  if (windSpeed != null && windSpeed > 12) {
    anomalies.push('风速超出安全范围')
    matchedData.windSpeed = windSpeed
    matchedData.windSpeedLimit = 12
  }

  if (anomalies.length === 0) return null

  return {
    id: uuidv4(),
    recordId: '',
    ruleName: '异常识别规则',
    ruleType: 'anomaly',
    triggeredAt: new Date().toISOString(),
    matchedData,
    conclusion: `检测到${anomalies.length}项飞行异常：${anomalies.join('、')}`,
    reasoning: `飞行参数中${anomalies.join('、')}超出了安全阈值范围，这些异常可能影响巡检质量和飞行安全，需要外场队长确认异常原因并评估是否需要重新巡检`,
    suggestedAction: '外场队长需逐一确认异常原因（设备故障/天气原因/操作失误），评估巡检数据有效性，决定是否需要安排补飞，并在记录中注明处理结果',
    severity: anomalies.length >= 2 ? 'critical' : 'warning',
    confirmed: false,
  }
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180)
}

export function runJudgmentEngine(req: JudgeRequest): JudgeResponse {
  const { recordId, flightData } = req
  const judgments: Judgment[] = []

  const noFlyJudgment = checkNoFlyZone(flightData)
  if (noFlyJudgment) {
    noFlyJudgment.recordId = recordId
    judgments.push(noFlyJudgment)
  }

  const integrityJudgment = checkDataIntegrity(flightData)
  if (integrityJudgment) {
    integrityJudgment.recordId = recordId
    judgments.push(integrityJudgment)
  }

  const anomalyJudgment = checkAnomalies(flightData)
  if (anomalyJudgment) {
    anomalyJudgment.recordId = recordId
    judgments.push(anomalyJudgment)
  }

  let overallStatus: RecordStatus = 'normal'
  if (judgments.some(j => j.severity === 'critical')) {
    overallStatus = 'critical'
  } else if (judgments.some(j => j.severity === 'warning')) {
    overallStatus = 'warning'
  }

  return { judgments, overallStatus }
}

export function saveJudgments(recordId: string, judgments: Judgment[], actor: string = 'system'): void {
  const db = getDb()
  const insertStmt = db.prepare(`
    INSERT INTO judgments (id, record_id, rule_name, rule_type, triggered_at, matched_data, conclusion, reasoning, suggested_action, severity, confirmed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  for (const j of judgments) {
    insertStmt.run(
      j.id,
      j.recordId,
      j.ruleName,
      j.ruleType,
      j.triggeredAt,
      JSON.stringify(j.matchedData),
      j.conclusion,
      j.reasoning,
      j.suggestedAction,
      j.severity,
      j.confirmed ? 1 : 0
    )

    logAuditEvent(recordId, 'judgment', actor, `判断引擎触发规则[${j.ruleName}]，结论：${j.conclusion}`, {
      ruleType: j.ruleType,
      severity: j.severity,
      reasoning: j.reasoning,
      suggestedAction: j.suggestedAction,
    })
  }
}

export function confirmJudgment(recordId: string, judgmentId: string, confirmedBy: string): Judgment {
  const db = getDb()
  const now = new Date().toISOString()

  db.prepare(`
    UPDATE judgments SET confirmed = 1, confirmed_by = ?, confirmed_at = ?
    WHERE id = ? AND record_id = ?
  `).run(confirmedBy, now, judgmentId, recordId)

  const row = db.prepare('SELECT * FROM judgments WHERE id = ?').get(judgmentId) as JudgmentRow

  logAuditEvent(recordId, 'judgment', confirmedBy, `判断[${row.rule_name}]已被${confirmedBy}确认`, {
    judgmentId,
    ruleName: row.rule_name,
    conclusion: row.conclusion,
  })

  return rowToJudgment(row)
}

export function getJudgmentsByRecordId(recordId: string): Judgment[] {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM judgments WHERE record_id = ? ORDER BY triggered_at DESC').all(recordId) as JudgmentRow[]
  return rows.map(rowToJudgment)
}

export function getRules(): { id: string; name: string; type: RuleType; description: string; enabled: boolean }[] {
  return [
    { id: 'rule-noflyzone', name: '禁飞区擦边检测', type: 'no_fly_zone', description: '检测飞行路径是否靠近或进入禁飞区范围（1.2倍警戒圈）', enabled: true },
    { id: 'rule-integrity', name: '数据完整性校验', type: 'data_integrity', description: '校验巡检记录必填字段是否完整（纬度、经度、高度、电量、时长）', enabled: true },
    { id: 'rule-anomaly', name: '异常识别规则', type: 'anomaly', description: '识别飞行参数异常：高度>500m、电量<15%、时长>60min、风速>12m/s', enabled: true },
  ]
}
