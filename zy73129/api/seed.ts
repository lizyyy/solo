import crypto from 'crypto'
import db from './db.js'

export function seed(): void {
  const count = db.prepare('SELECT COUNT(*) as cnt FROM survey_records').get() as { cnt: number }
  if (count.cnt > 0) return

  const insertRecord = db.prepare(`
    INSERT INTO survey_records (id, site_name, latitude, longitude, sample_time, experiment_result, bleaching_level, source_type)
    VALUES (@id, @site_name, @latitude, @longitude, @sample_time, @experiment_result, @bleaching_level, @source_type)
  `)

  const insertAnnotation = db.prepare(`
    INSERT INTO annotations (id, record_id, annotator, content, is_retroactive)
    VALUES (@id, @record_id, @annotator, @content, @is_retroactive)
  `)

  const insertRun = db.prepare(`
    INSERT INTO report_runs (id, parameter_snapshot_id, status, total_records, anomaly_count)
    VALUES (@id, @parameter_snapshot_id, @status, @total_records, @anomaly_count)
  `)

  const insertSnapshot = db.prepare(`
    INSERT INTO parameter_snapshots (id, run_id, parameters, changed_from, change_step, impact_summary)
    VALUES (@id, @run_id, @parameters, @changed_from, @change_step, @impact_summary)
  `)

  const insertAnomaly = db.prepare(`
    INSERT INTO anomaly_records (id, run_id, record_id, anomaly_type, severity, description, trace_chain, summary_mapping, status)
    VALUES (@id, @run_id, @record_id, @anomaly_type, @severity, @description, @trace_chain, @summary_mapping, @status)
  `)

  const insertCorrection = db.prepare(`
    INSERT INTO coordinate_corrections (id, anomaly_id, original_lat, original_lng, corrected_lat, corrected_lng, persisted_to_detail, persisted_to_file)
    VALUES (@id, @anomaly_id, @original_lat, @original_lng, @corrected_lat, @corrected_lng, @persisted_to_detail, @persisted_to_file)
  `)

  const records = [
    { id: crypto.randomUUID(), site_name: '大堡礁-A3', latitude: -18.2871, longitude: 147.6992, sample_time: '2024-06-15T08:30:00', experiment_result: '2024-06 白化等级III', bleaching_level: 3, source_type: 'original' },
    { id: crypto.randomUUID(), site_name: '三亚湾-B1', latitude: 18.2048, longitude: 109.4420, sample_time: '2024-07-20T10:00:00', experiment_result: '2024-07 白化等级II', bleaching_level: 2, source_type: 'original' },
    { id: crypto.randomUUID(), site_name: '涠洲岛-C2', latitude: 109.1500, longitude: 21.0500, sample_time: '2024-08-05T14:20:00', experiment_result: '2024-08 白化等级IV', bleaching_level: 4, source_type: 'original' },
    { id: crypto.randomUUID(), site_name: '西沙群岛-D1', latitude: 16.8300, longitude: 112.3300, sample_time: '2024-06-10T09:15:00', experiment_result: '2024-08 白化等级III', bleaching_level: 3, source_type: 'original' },
    { id: crypto.randomUUID(), site_name: '南沙群岛-E4', latitude: 114.2800, longitude: 10.2300, sample_time: '2024-09-01T11:00:00', experiment_result: '2024-09 白化等级I', bleaching_level: 1, source_type: 'original' },
    { id: crypto.randomUUID(), site_name: '大堡礁-F2', latitude: -23.4500, longitude: 152.0700, sample_time: '2024-05-28T07:45:00', experiment_result: '2024-05 白化等级II', bleaching_level: 2, source_type: 'retroactive_note' },
    { id: crypto.randomUUID(), site_name: '涠洲岛-G1', latitude: 109.1800, longitude: 21.0200, sample_time: '2024-07-15T16:30:00', experiment_result: '2024-07 白化等级V', bleaching_level: 5, source_type: 'original' },
    { id: crypto.randomUUID(), site_name: '三亚湾-H3', latitude: 18.2100, longitude: 109.4500, sample_time: '2024-08-22T13:10:00', experiment_result: '2024-06 白化等级II', bleaching_level: 2, source_type: 'original' },
    { id: crypto.randomUUID(), site_name: '大堡礁-I1', latitude: -16.9200, longitude: 145.7700, sample_time: '2024-09-10T10:30:00', experiment_result: '2024-09 白化等级I', bleaching_level: 1, source_type: 'retroactive_note' },
    { id: crypto.randomUUID(), site_name: '西沙群岛-J2', latitude: 112.3500, longitude: 16.8400, sample_time: '2024-06-25T08:00:00', experiment_result: '2024-06 白化等级III', bleaching_level: 3, source_type: 'original' },
    { id: crypto.randomUUID(), site_name: '南沙群岛-K3', latitude: 10.2300, longitude: 114.2700, sample_time: '2024-07-30T15:45:00', experiment_result: '2024-07 白化等级IV', bleaching_level: 4, source_type: 'original' },
    { id: crypto.randomUUID(), site_name: '涠洲岛-L1', latitude: 21.0400, longitude: 109.1600, sample_time: '2024-08-18T09:50:00', experiment_result: '2024-08 白化等级II', bleaching_level: 2, source_type: 'original' },
    { id: crypto.randomUUID(), site_name: '大堡礁-M2', latitude: -20.3500, longitude: 149.1200, sample_time: '2024-10-05T12:20:00', experiment_result: '2024-10 白化等级I', bleaching_level: 1, source_type: 'original' },
    { id: crypto.randomUUID(), site_name: '三亚湾-N1', latitude: 109.5000, longitude: 18.3000, sample_time: '2024-09-15T11:30:00', experiment_result: '2024-09 白化等级III', bleaching_level: 3, source_type: 'original' },
  ]

  const transaction = db.transaction(() => {
    for (const r of records) {
      insertRecord.run(r)
    }

    insertAnnotation.run({
      id: crypto.randomUUID(),
      record_id: records[2].id,
      annotator: '阿宁',
      content: '涠洲岛C2站坐标疑似经纬度互换，实际纬度不应超过90度',
      is_retroactive: 1,
    })

    insertAnnotation.run({
      id: crypto.randomUUID(),
      record_id: records[3].id,
      annotator: '李明',
      content: '采样时间为6月但实验结果引用8月数据，需核实是否录入错误',
      is_retroactive: 0,
    })

    insertAnnotation.run({
      id: crypto.randomUUID(),
      record_id: records[5].id,
      annotator: '阿宁',
      content: '此条记录为后补备注，来源于航海日志手写记录，时间可能有偏差',
      is_retroactive: 1,
    })

    const run1Id = crypto.randomUUID()
    const run2Id = crypto.randomUUID()
    const snap1Id = crypto.randomUUID()
    const snap2Id = crypto.randomUUID()

    insertSnapshot.run({
      id: snap1Id,
      run_id: null,
      parameters: JSON.stringify({ bleaching_threshold: 2, coordinate_tolerance: 1.0, time_gap_hours: 48 }),
      changed_from: null,
      change_step: 0,
      impact_summary: null,
    })

    insertSnapshot.run({
      id: snap2Id,
      run_id: null,
      parameters: JSON.stringify({ bleaching_threshold: 3, coordinate_tolerance: 1.0, time_gap_hours: 48 }),
      changed_from: JSON.stringify({ bleaching_threshold: 2 }),
      change_step: 1,
      impact_summary: JSON.stringify({ field: 'bleaching_threshold', from: 2, to: 3, affected_records: 4 }),
    })

    insertRun.run({
      id: run1Id,
      parameter_snapshot_id: snap1Id,
      status: 'completed',
      total_records: 14,
      anomaly_count: 7,
    })

    insertRun.run({
      id: run2Id,
      parameter_snapshot_id: snap2Id,
      status: 'completed',
      total_records: 14,
      anomaly_count: 5,
    })

    db.prepare('UPDATE parameter_snapshots SET run_id = ? WHERE id = ?').run(run1Id, snap1Id)
    db.prepare('UPDATE parameter_snapshots SET run_id = ? WHERE id = ?').run(run2Id, snap2Id)

    const anomaly1Id = crypto.randomUUID()
    const anomaly2Id = crypto.randomUUID()
    const anomaly3Id = crypto.randomUUID()
    const anomaly4Id = crypto.randomUUID()
    const anomaly5Id = crypto.randomUUID()
    const anomaly6Id = crypto.randomUUID()
    const anomaly7Id = crypto.randomUUID()

    insertAnomaly.run({
      id: anomaly1Id,
      run_id: run1Id,
      record_id: records[2].id,
      anomaly_type: 'coordinate_swap',
      severity: 'critical',
      description: '涠洲岛-C2纬度值109.15超过90度范围，疑似经纬度互换',
      trace_chain: JSON.stringify({ record_id: records[2].id, site: '涠洲岛-C2', original: { lat: 109.15, lng: 21.05 }, expected_range: { lat: [-90, 90], lng: [-180, 180] }, violation: 'latitude > 90' }),
      summary_mapping: JSON.stringify({ site: '涠洲岛-C2', field: 'latitude', value: 109.15, corrected: 21.05 }),
      status: 'open',
    })

    insertAnomaly.run({
      id: anomaly2Id,
      run_id: run1Id,
      record_id: records[4].id,
      anomaly_type: 'coordinate_swap',
      severity: 'critical',
      description: '南沙群岛-E4纬度值114.28超过90度范围，疑似经纬度互换',
      trace_chain: JSON.stringify({ record_id: records[4].id, site: '南沙群岛-E4', original: { lat: 114.28, lng: 10.23 }, expected_range: { lat: [-90, 90], lng: [-180, 180] }, violation: 'latitude > 90' }),
      summary_mapping: JSON.stringify({ site: '南沙群岛-E4', field: 'latitude', value: 114.28, corrected: 10.23 }),
      status: 'acknowledged',
    })

    insertAnomaly.run({
      id: anomaly3Id,
      run_id: run1Id,
      record_id: records[9].id,
      anomaly_type: 'coordinate_swap',
      severity: 'critical',
      description: '西沙群岛-J2纬度值112.35超过90度范围，疑似经纬度互换',
      trace_chain: JSON.stringify({ record_id: records[9].id, site: '西沙群岛-J2', original: { lat: 112.35, lng: 16.84 }, expected_range: { lat: [-90, 90], lng: [-180, 180] }, violation: 'latitude > 90' }),
      summary_mapping: JSON.stringify({ site: '西沙群岛-J2', field: 'latitude', value: 112.35, corrected: 16.84 }),
      status: 'open',
    })

    insertAnomaly.run({
      id: anomaly4Id,
      run_id: run1Id,
      record_id: records[3].id,
      anomaly_type: 'time_mismatch',
      severity: 'warning',
      description: '西沙群岛-D1采样时间为2024-06但实验结果引用2024-08数据',
      trace_chain: JSON.stringify({ record_id: records[3].id, site: '西沙群岛-D1', sample_time: '2024-06-10', result_referenced: '2024-08', mismatch_months: 2 }),
      summary_mapping: JSON.stringify({ site: '西沙群岛-D1', sample_month: '2024-06', result_month: '2024-08' }),
      status: 'open',
    })

    insertAnomaly.run({
      id: anomaly5Id,
      run_id: run1Id,
      record_id: records[7].id,
      anomaly_type: 'time_mismatch',
      severity: 'warning',
      description: '三亚湾-H3采样时间为2024-08但实验结果引用2024-06数据',
      trace_chain: JSON.stringify({ record_id: records[7].id, site: '三亚湾-H3', sample_time: '2024-08-22', result_referenced: '2024-06', mismatch_months: 2 }),
      summary_mapping: JSON.stringify({ site: '三亚湾-H3', sample_month: '2024-08', result_month: '2024-06' }),
      status: 'resolved',
    })

    insertAnomaly.run({
      id: anomaly6Id,
      run_id: run1Id,
      record_id: records[6].id,
      anomaly_type: 'bleaching_anomaly',
      severity: 'critical',
      description: '涠洲岛-G1白化等级为V级，超过阈值2',
      trace_chain: JSON.stringify({ record_id: records[6].id, site: '涠洲岛-G1', bleaching_level: 5, threshold: 2, exceed_by: 3 }),
      summary_mapping: JSON.stringify({ site: '涠洲岛-G1', bleaching_level: 5, threshold: 2 }),
      status: 'open',
    })

    insertAnomaly.run({
      id: anomaly7Id,
      run_id: run1Id,
      record_id: records[13].id,
      anomaly_type: 'data_gap',
      severity: 'info',
      description: '三亚湾-N1纬度值109.5超过90度，且该时间段缺少连续采样数据',
      trace_chain: JSON.stringify({ record_id: records[13].id, site: '三亚湾-N1', expected_records: 4, actual_records: 1, gap_dates: ['2024-09-16', '2024-09-17', '2024-09-18'] }),
      summary_mapping: JSON.stringify({ site: '三亚湾-N1', gap_start: '2024-09-16', gap_end: '2024-09-18' }),
      status: 'open',
    })

    insertCorrection.run({
      id: crypto.randomUUID(),
      anomaly_id: anomaly1Id,
      original_lat: 109.15,
      original_lng: 21.05,
      corrected_lat: 21.05,
      corrected_lng: 109.15,
      persisted_to_detail: 1,
      persisted_to_file: 1,
    })

    insertCorrection.run({
      id: crypto.randomUUID(),
      anomaly_id: anomaly2Id,
      original_lat: 114.28,
      original_lng: 10.23,
      corrected_lat: 10.23,
      corrected_lng: 114.28,
      persisted_to_detail: 0,
      persisted_to_file: 0,
    })
  })

  transaction()
}
