import { v4 as uuidv4 } from 'uuid'
import { getDb } from './database.js'
import { logAuditEvent } from './services/auditService.js'

function seed(): void {
  const db = getDb()

  const countRow = db.prepare('SELECT COUNT(*) as count FROM inspection_records').get() as { count: number }
  if (countRow.count > 0) {
    console.log('数据库已有数据，跳过种子数据')
    return
  }

  const now = new Date().toISOString()
  const today = now.slice(0, 10)

  const normalRecords = [
    { towerId: 'T001', towerName: '龙泉山#01塔', flightDate: '2025-05-25', flightTime: '08:30', pilotName: '张伟', flightData: { latitude: 30.65, longitude: 104.10, altitude: 120, batteryLevel: 85, flightDuration: 25, windSpeed: 3 } },
    { towerId: 'T002', towerName: '龙泉山#02塔', flightDate: '2025-05-25', flightTime: '09:15', pilotName: '李强', flightData: { latitude: 30.66, longitude: 104.12, altitude: 150, batteryLevel: 78, flightDuration: 30, windSpeed: 4 } },
    { towerId: 'T003', towerName: '青城山#01塔', flightDate: '2025-05-26', flightTime: '07:45', pilotName: '王磊', flightData: { latitude: 30.90, longitude: 103.57, altitude: 200, batteryLevel: 92, flightDuration: 20, windSpeed: 2 } },
    { towerId: 'T004', towerName: '青城山#02塔', flightDate: '2025-05-26', flightTime: '10:00', pilotName: '赵刚', flightData: { latitude: 30.92, longitude: 103.60, altitude: 180, batteryLevel: 65, flightDuration: 35, windSpeed: 5 } },
    { towerId: 'T005', towerName: '峨眉山#01塔', flightDate: '2025-05-27', flightTime: '08:00', pilotName: '陈明', flightData: { latitude: 29.60, longitude: 103.33, altitude: 250, batteryLevel: 70, flightDuration: 28, windSpeed: 6 } },
  ]

  const normalRecordIds: string[] = []

  for (const r of normalRecords) {
    const id = uuidv4()
    normalRecordIds.push(id)
    db.prepare(`
      INSERT INTO inspection_records (id, tower_id, tower_name, flight_date, flight_time, pilot_name, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'normal', ?, ?)
    `).run(id, r.towerId, r.towerName, r.flightDate, r.flightTime, r.pilotName, now, now)

    db.prepare(`
      INSERT INTO attachments (id, record_id, file_name, file_size, file_type, source, arrived_at, file_path)
      VALUES (?, ?, ?, ?, ?, 'original', ?, ?)
    `).run(uuidv4(), id, `${r.towerId}_flight_log.json`, 2048, 'application/json', now, `/data/attachments/${r.towerId}_flight_log.json`)

    db.prepare(`
      INSERT INTO attachments (id, record_id, file_name, file_size, file_type, source, arrived_at, file_path)
      VALUES (?, ?, ?, ?, ?, 'original', ?, ?)
    `).run(uuidv4(), id, `${r.towerId}_photo_001.jpg`, 3072000, 'image/jpeg', now, `/data/attachments/${r.towerId}_photo_001.jpg`)

    logAuditEvent(id, 'import', 'seed', `导入正常巡检记录：${r.towerName}(${r.towerId})`)
  }

  const lateAttachmentRecords = [
    { towerId: 'T006', towerName: '龙泉山#03塔', flightDate: '2025-05-25', flightTime: '11:00', pilotName: '张伟', flightData: { latitude: 30.68, longitude: 104.15, altitude: 130, batteryLevel: 80, flightDuration: 22, windSpeed: 3 } },
    { towerId: 'T007', towerName: '青城山#03塔', flightDate: '2025-05-26', flightTime: '14:30', pilotName: '王磊', flightData: { latitude: 30.95, longitude: 103.55, altitude: 160, batteryLevel: 75, flightDuration: 32, windSpeed: 4 } },
  ]

  for (const r of lateAttachmentRecords) {
    const id = uuidv4()
    db.prepare(`
      INSERT INTO inspection_records (id, tower_id, tower_name, flight_date, flight_time, pilot_name, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'normal', ?, ?)
    `).run(id, r.towerId, r.towerName, r.flightDate, r.flightTime, r.pilotName, now, now)

    db.prepare(`
      INSERT INTO attachments (id, record_id, file_name, file_size, file_type, source, arrived_at, file_path)
      VALUES (?, ?, ?, ?, ?, 'original', ?, ?)
    `).run(uuidv4(), id, `${r.towerId}_flight_log.json`, 2048, 'application/json', now, `/data/attachments/${r.towerId}_flight_log.json`)

    const lateTime = new Date(Date.now() + 86400000).toISOString()
    db.prepare(`
      INSERT INTO attachments (id, record_id, file_name, file_size, file_type, source, arrived_at, file_path)
      VALUES (?, ?, ?, ?, ?, 'late_arrival', ?, ?)
    `).run(uuidv4(), id, `${r.towerId}_thermal_scan.tiff`, 5242880, 'image/tiff', lateTime, `/data/attachments/${r.towerId}_thermal_scan.tiff`)

    logAuditEvent(id, 'attachment_add', 'seed', `晚到附件归位：${r.towerId}_thermal_scan.tiff`, { source: 'late_arrival', fileName: `${r.towerId}_thermal_scan.tiff` })
  }

  const duplicateRecords = [
    { towerId: 'T001', towerName: '龙泉山#01塔', flightDate: '2025-05-25', flightTime: '08:30', pilotName: '张伟', flightData: { latitude: 30.65, longitude: 104.10, altitude: 120, batteryLevel: 85, flightDuration: 25, windSpeed: 3 } },
    { towerId: 'T002', towerName: '龙泉山#02塔', flightDate: '2025-05-25', flightTime: '09:15', pilotName: '李强', flightData: { latitude: 30.66, longitude: 104.12, altitude: 150, batteryLevel: 78, flightDuration: 30, windSpeed: 4 } },
  ]

  const batchId = uuidv4()
  db.prepare(`
    INSERT INTO import_batches (id, batch_name, imported_at, imported_by, total_items, normal_count, late_count, duplicate_count, correction_count, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(batchId, '重复数据检测批次', now, 'seed', 2, 0, 0, 2, 0, 'completed')

  for (const r of duplicateRecords) {
    const itemId = uuidv4()
    db.prepare(`
      INSERT INTO import_items (id, batch_id, item_type, data, action_taken, processed_at)
      VALUES (?, ?, 'duplicate', ?, 'reject', ?)
    `).run(itemId, batchId, JSON.stringify(r), now)

    const existingRecordId = db.prepare('SELECT id FROM inspection_records WHERE tower_id = ? AND flight_date = ? AND flight_time = ? AND pilot_name = ?').get(r.towerId, r.flightDate, r.flightTime, r.pilotName) as { id: string } | undefined
    if (existingRecordId) {
      logAuditEvent(existingRecordId.id, 'import', 'seed', `检测到重复项：${r.towerId} ${r.flightDate} ${r.flightTime} ${r.pilotName}`, { itemType: 'duplicate', batchId })
    }
  }

  const correctionRecord = {
    towerId: 'T008', towerName: '峨眉山#02塔', flightDate: '2025-05-27', flightTime: '09:30',
    pilotName: '刘洋', flightData: { latitude: 29.62, longitude: 103.35, altitude: 190, batteryLevel: 60, flightDuration: 40, windSpeed: 7 },
  }

  const correctionId = uuidv4()
  db.prepare(`
    INSERT INTO inspection_records (id, tower_id, tower_name, flight_date, flight_time, pilot_name, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'corrected', ?, ?)
  `).run(correctionId, correctionRecord.towerId, correctionRecord.towerName, correctionRecord.flightDate, correctionRecord.flightTime, correctionRecord.pilotName, now, now)

  db.prepare(`
    INSERT INTO corrections (id, record_id, field_name, old_value, new_value, reason, corrected_by, corrected_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), correctionId, 'pilot_name', '刘洋', '刘海洋', '原记录飞行员姓名录入错误，根据飞行任务单更正为刘海洋', '数据管理员王华', now)

  logAuditEvent(correctionId, 'correction', '数据管理员王华', '人工更正飞行员姓名：刘洋 → 刘海洋，原因：原记录飞行员姓名录入错误，根据飞行任务单更正为刘海洋', {
    fieldName: 'pilot_name',
    oldValue: '刘洋',
    newValue: '刘海洋',
  })

  const noFlyEdgeRecords = [
    { towerId: 'T009', towerName: '双流#01塔', flightDate: '2025-05-28', flightTime: '10:00', pilotName: '周军', flightData: { latitude: 30.60, longitude: 104.08, altitude: 100, batteryLevel: 88, flightDuration: 15, windSpeed: 2 } },
    { towerId: 'T010', towerName: '浦东#01塔', flightDate: '2025-05-28', flightTime: '14:00', pilotName: '吴斌', flightData: { latitude: 31.28, longitude: 121.52, altitude: 110, batteryLevel: 82, flightDuration: 18, windSpeed: 3 } },
  ]

  for (const r of noFlyEdgeRecords) {
    const id = uuidv4()
    const lat = r.flightData.latitude as number
    const lng = r.flightData.longitude as number

    let zoneName = ''
    let distanceKm = 0
    let zoneRadiusKm = 0
    let edgeDistance = 0

    if (lat > 31.0) {
      zoneName = '军事禁区B'
      zoneRadiusKm = 8
      distanceKm = 8.5
      edgeDistance = 0.5
    } else {
      zoneName = '机场禁飞区A'
      zoneRadiusKm = 5
      distanceKm = 5.8
      edgeDistance = 0.8
    }

    const severity = edgeDistance < 0.5 ? 'critical' : 'warning'

    db.prepare(`
      INSERT INTO inspection_records (id, tower_id, tower_name, flight_date, flight_time, pilot_name, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, r.towerId, r.towerName, r.flightDate, r.flightTime, r.pilotName, severity, now, now)

    const judgmentId = uuidv4()
    db.prepare(`
      INSERT INTO judgments (id, record_id, rule_name, rule_type, triggered_at, matched_data, conclusion, reasoning, suggested_action, severity, confirmed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      judgmentId,
      id,
      '禁飞区擦边检测',
      'no_fly_zone',
      now,
      JSON.stringify({ zone: zoneName, distanceKm, zoneRadiusKm, flightLat: lat, flightLng: lng }),
      `飞行路径距${zoneName}边缘仅${edgeDistance}km，属于禁飞区擦边飞行`,
      `无人机飞行坐标(${lat},${lng})距${zoneName}中心${distanceKm}km，禁飞区半径${zoneRadiusKm}km，距边界仅${edgeDistance}km，处于1.2倍警戒范围内，存在误入禁飞区风险`,
      `建议外场队长核实飞行航线是否获得禁飞区边缘飞行许可，若无许可需立即调整后续飞行计划，并在记录中补充飞行豁免证明`,
      severity,
      0
    )

    logAuditEvent(id, 'judgment', 'system', `判断引擎触发规则[禁飞区擦边检测]，结论：飞行路径距${zoneName}边缘仅${edgeDistance}km`, {
      ruleType: 'no_fly_zone',
      severity,
      reasoning: `无人机飞行坐标(${lat},${lng})距${zoneName}中心${distanceKm}km，禁飞区半径${zoneRadiusKm}km，距边界仅${edgeDistance}km`,
      suggestedAction: '建议外场队长核实飞行航线是否获得禁飞区边缘飞行许可',
    })

    db.prepare(`
      INSERT INTO attachments (id, record_id, file_name, file_size, file_type, source, arrived_at, file_path)
      VALUES (?, ?, ?, ?, ?, 'original', ?, ?)
    `).run(uuidv4(), id, `${r.towerId}_flight_log.json`, 2048, 'application/json', now, `/data/attachments/${r.towerId}_flight_log.json`)
  }

  console.log('种子数据写入完成：正常记录5条、晚到附件2条、重复项2条、人工更正1条、禁飞区擦边2条')
}

seed()
