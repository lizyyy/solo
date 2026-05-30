import { Router, type Request, type Response } from 'express'
import { getDb } from '../db.js'
import { randomUUID } from 'crypto'
import type { EstimationWarning, TraceLink } from '../../shared/types.js'

const router = Router()

const G = 9.81
const AIR_DENSITY = 1.225
const DRAG_COEFFICIENT = 0.4
const FRONTAL_AREA = 0.02
const ROLLING_RESISTANCE_COEFF = 0.015
const LIGHT_THRESHOLD = 200
const GEAR_RATIO_MIN = 0.5
const GEAR_RATIO_MAX = 10

function runEstimation(car: any, track: any, lightRecords: any[]) {
  const warnings: EstimationWarning[] = []

  const avgLight = lightRecords.length > 0
    ? lightRecords.reduce((s: number, r: any) => s + r.intensity_wm2, 0) / lightRecords.length
    : 0

  const lowLightIds = lightRecords.filter((r: any) => r.intensity_wm2 < LIGHT_THRESHOLD).map((r: any) => r.id)
  if (lowLightIds.length > 0) {
    warnings.push({
      type: 'light_gap',
      message: `${lowLightIds.length}条光照记录低于${LIGHT_THRESHOLD} W/m²阈值`,
      business_impact: '光照不足可能导致小车无法获得足够动力，完赛时间大幅增加甚至无法完赛，影响参赛名单和比赛预算',
      source_ids: lowLightIds
    })
  }

  if (track.slope_percent > 10 && track.slope_direction === 'uphill') {
    warnings.push({
      type: 'slope_direction_reversed',
      message: `坡度${track.slope_percent}%为上坡方向，阻力极大`,
      business_impact: '上坡大坡度将显著增加完赛时间，可能需要更换赛道方案或增加动力配置，影响预算和时间安排',
      source_ids: [track.id]
    })
  }

  if (track.gear_ratio > GEAR_RATIO_MAX || track.gear_ratio < GEAR_RATIO_MIN) {
    warnings.push({
      type: 'gear_ratio_out_of_range',
      message: `齿轮比${track.gear_ratio}超出正常范围(${GEAR_RATIO_MIN}-${GEAR_RATIO_MAX})`,
      business_impact: '齿轮比越界可能导致扭矩不足或转速过高，影响完赛时间和零件采购预算',
      source_ids: [track.id]
    })
  }

  const availablePower = avgLight * car.panel_area_m2 * (car.panel_efficiency_percent / 100) * (car.motor_efficiency_percent / 100)
  const motorPower = car.motor_power_w
  const effectivePower = Math.min(availablePower, motorPower)

  if (effectivePower < 0.1) {
    warnings.push({
      type: 'power_insufficient',
      message: `有效功率仅${effectivePower.toFixed(3)}W，远低于驱动需求`,
      business_impact: '功率严重不足，小车可能无法启动或无法完赛，需要更换太阳能板或电机，直接影响预算和参赛资格',
      source_ids: [car.id, ...lightRecords.map((r: any) => r.id)]
    })
  }

  const slopeResistance = car.mass_kg * G * Math.sin(Math.atan(track.slope_percent / 100))
  const rollingResistance = car.mass_kg * G * ROLLING_RESISTANCE_COEFF * Math.cos(Math.atan(track.slope_percent / 100))
  const wheelRadius = car.wheel_diameter_m / 2
  const motorSpeedRad = (car.motor_rpm * 2 * Math.PI) / 60
  const wheelSpeedRad = motorSpeedRad / track.gear_ratio
  const vehicleSpeed = wheelSpeedRad * wheelRadius
  const aeroResistance = 0.5 * AIR_DENSITY * DRAG_COEFFICIENT * FRONTAL_AREA * vehicleSpeed * vehicleSpeed

  const totalResistance = slopeResistance + rollingResistance + aeroResistance
  const netForce = (effectivePower / Math.max(vehicleSpeed, 0.01)) - totalResistance
  let estimatedTime = track.track_length_m / Math.max(vehicleSpeed, 0.01)

  if (netForce > 0) {
    const acceleration = netForce / car.mass_kg
    const timeToMaxSpeed = vehicleSpeed / Math.max(acceleration, 0.001)
    const distDuringAccel = 0.5 * vehicleSpeed * timeToMaxSpeed
    if (distDuringAccel < track.track_length_m) {
      estimatedTime = timeToMaxSpeed + (track.track_length_m - distDuringAccel) / vehicleSpeed
    } else {
      estimatedTime = Math.sqrt(2 * track.track_length_m / Math.max(acceleration, 0.001))
    }
  }

  if (netForce <= 0) {
    estimatedTime = -1
  }

  return {
    available_power_w: availablePower,
    effective_power_w: effectivePower,
    slope_resistance_n: slopeResistance,
    rolling_resistance_n: rollingResistance,
    aero_resistance_n: aeroResistance,
    total_resistance_n: totalResistance,
    net_force_n: netForce,
    estimated_time_s: estimatedTime,
    vehicle_speed_ms: vehicleSpeed,
    warnings
  }
}

router.post('/', (req: Request, res: Response) => {
  const db = getDb()
  const { project_id, car_params_id, track_params_id, light_record_ids } = req.body
  if (!project_id || !car_params_id || !track_params_id) {
    res.status(400).json({ success: false, error: 'project_id、car_params_id、track_params_id 必填' })
    return
  }

  const car = db.prepare('SELECT * FROM car_params WHERE id = ?').get(car_params_id) as any
  const track = db.prepare('SELECT * FROM track_params WHERE id = ?').get(track_params_id) as any
  if (!car || !track) {
    res.status(404).json({ success: false, error: '小车参数或赛道参数不存在' })
    return
  }

  let lightRecords: any[] = []
  if (light_record_ids && light_record_ids.length > 0) {
    const placeholders = light_record_ids.map(() => '?').join(',')
    lightRecords = db.prepare(`SELECT * FROM light_records WHERE id IN (${placeholders})`).all(...light_record_ids)
  } else {
    lightRecords = db.prepare('SELECT * FROM light_records WHERE project_id = ?').all(project_id)
  }

  const result = runEstimation(car, track, lightRecords)
  const id = randomUUID()

  db.prepare(`INSERT INTO estimation_reports (id, project_id, car_params_id, track_params_id, light_record_ids,
    available_power_w, slope_resistance_n, rolling_resistance_n, aero_resistance_n, total_resistance_n,
    net_force_n, estimated_time_s, warnings_json, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, project_id, car_params_id, track_params_id,
      JSON.stringify(lightRecords.map((r: any) => r.id)),
      result.available_power_w, result.slope_resistance_n, result.rolling_resistance_n,
      result.aero_resistance_n, result.total_resistance_n, result.net_force_n,
      result.estimated_time_s, JSON.stringify(result.warnings), 'pending')

  const row = db.prepare('SELECT * FROM estimation_reports WHERE id = ?').get(id)
  res.json({
    success: true,
    data: {
      ...(row as Record<string, unknown>),
      warnings: result.warnings,
      vehicle_speed_ms: result.vehicle_speed_ms,
      effective_power_w: result.effective_power_w
    }
  })
})

router.get('/', (req: Request, res: Response) => {
  const db = getDb()
  const projectId = req.query.project_id as string
  if (!projectId) {
    res.status(400).json({ success: false, error: 'project_id 必填' })
    return
  }
  const rows = db.prepare('SELECT * FROM estimation_reports WHERE project_id = ? ORDER BY created_at DESC').all(projectId)
  const enriched = rows.map((r: any) => ({
    ...r,
    warnings: JSON.parse(r.warnings_json || '[]'),
    light_record_ids: JSON.parse(r.light_record_ids || '[]')
  }))
  res.json({ success: true, data: enriched })
})

router.get('/:id/trace', (req: Request, res: Response) => {
  const db = getDb()
  const report = db.prepare('SELECT * FROM estimation_reports WHERE id = ?').get(req.params.id) as any
  if (!report) {
    res.status(404).json({ success: false, error: '估算报告不存在' })
    return
  }

  const car = db.prepare('SELECT * FROM car_params WHERE id = ?').get(report.car_params_id) as any
  const track = db.prepare('SELECT * FROM track_params WHERE id = ?').get(report.track_params_id) as any
  const lightIds = JSON.parse(report.light_record_ids || '[]') as string[]
  const lights = lightIds.length > 0
    ? db.prepare(`SELECT * FROM light_records WHERE id IN (${lightIds.map(() => '?').join(',')})`).all(...lightIds)
    : []

  const trace: TraceLink[] = [
    {
      field: 'available_power_w',
      value: report.available_power_w,
      source_type: 'light_records + car_params',
      source_id: lightIds.join(', '),
      source_label: '光照记录 + 太阳能板参数',
      source_detail: `光照记录${lightIds.length}条, 平均光照${lights.length > 0 ? (lights.reduce((s: number, r: any) => s + Number(r.intensity_wm2), 0) / Number(lights.length)).toFixed(1) : 'N/A'} W/m²; 板面积${car?.panel_area_m2}m², 板效率${car?.panel_efficiency_percent}%, 电机效率${car?.motor_efficiency_percent}%`
    },
    {
      field: 'slope_resistance_n',
      value: report.slope_resistance_n,
      source_type: 'track_params + car_params',
      source_id: report.track_params_id,
      source_label: '赛道坡度 + 小车质量',
      source_detail: `坡度${track?.slope_percent}%, 方向${track?.slope_direction}; 质量${car?.mass_kg}kg`
    },
    {
      field: 'rolling_resistance_n',
      value: report.rolling_resistance_n,
      source_type: 'car_params',
      source_id: report.car_params_id,
      source_label: '小车质量',
      source_detail: `质量${car?.mass_kg}kg, 滚动阻力系数${ROLLING_RESISTANCE_COEFF}`
    },
    {
      field: 'aero_resistance_n',
      value: report.aero_resistance_n,
      source_type: 'track_params + car_params',
      source_id: `${report.track_params_id}, ${report.car_params_id}`,
      source_label: '齿轮比 + 轮径 + 电机转速',
      source_detail: `齿轮比${track?.gear_ratio}, 轮径${car?.wheel_diameter_m}m, 电机转速${car?.motor_rpm}rpm`
    },
    {
      field: 'estimated_time_s',
      value: report.estimated_time_s,
      source_type: 'all_params',
      source_id: `${report.car_params_id}, ${report.track_params_id}, ${lightIds.join(', ')}`,
      source_label: '全部参数综合',
      source_detail: `功率${report.available_power_w.toFixed(3)}W, 总阻力${report.total_resistance_n.toFixed(4)}N, 净力${report.net_force_n.toFixed(4)}N`
    }
  ]

  res.json({
    success: true,
    data: {
      report: {
        ...report,
        warnings: JSON.parse(report.warnings_json || '[]'),
        light_record_ids: lightIds
      },
      car,
      track,
      lights,
      trace
    }
  })
})

router.put('/:id/confirm', (req: Request, res: Response) => {
  const db = getDb()
  db.prepare('UPDATE estimation_reports SET status = ? WHERE id = ?').run('confirmed', req.params.id)
  const row = db.prepare('SELECT * FROM estimation_reports WHERE id = ?').get(req.params.id)
  res.json({ success: true, data: row })
})

router.get('/:id/export', (req: Request, res: Response) => {
  const db = getDb()
  const report = db.prepare('SELECT * FROM estimation_reports WHERE id = ?').get(req.params.id) as any
  if (!report) {
    res.status(404).json({ success: false, error: '估算报告不存在' })
    return
  }

  const car = db.prepare('SELECT * FROM car_params WHERE id = ?').get(report.car_params_id) as any
  const track = db.prepare('SELECT * FROM track_params WHERE id = ?').get(report.track_params_id) as any
  const lightIds = JSON.parse(report.light_record_ids || '[]') as string[]
  const lights = lightIds.length > 0
    ? db.prepare(`SELECT * FROM light_records WHERE id IN (${lightIds.map(() => '?').join(',')})`).all(...lightIds)
    : []
  const warnings = JSON.parse(report.warnings_json || '[]')

  const escape = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`

  const header = '字段,数值,来源类型,来源ID,来源说明,来源详情'
  const rows = [
    header,
    `可用功率(W),${report.available_power_w.toFixed(4)},光照+太阳能板,${lightIds.join('; ')},光照记录+板参数,光照${lights.length}条; 板面积${car?.panel_area_m2}m²`,
    `坡度阻力(N),${report.slope_resistance_n.toFixed(4)},赛道+小车,${report.track_params_id},坡度+质量,坡度${track?.slope_percent}% 方向${track?.slope_direction}; 质量${car?.mass_kg}kg`,
    `滚动阻力(N),${report.rolling_resistance_n.toFixed(4)},小车,${report.car_params_id},质量+摩擦系数,质量${car?.mass_kg}kg; 系数${ROLLING_RESISTANCE_COEFF}`,
    `空气阻力(N),${report.aero_resistance_n.toFixed(4)},赛道+小车,${report.track_params_id};${report.car_params_id},齿轮比+轮径+转速,齿轮比${track?.gear_ratio}; 轮径${car?.wheel_diameter_m}m; 转速${car?.motor_rpm}rpm`,
    `总阻力(N),${report.total_resistance_n.toFixed(4)},全部,综合,全部阻力叠加,坡度+滚动+空气`,
    `净力(N),${report.net_force_n.toFixed(4)},全部,综合,驱动力-总阻力,功率/速度-总阻力`,
    `预估时间(s),${report.estimated_time_s === -1 ? '无法完赛' : report.estimated_time_s.toFixed(2)},全部,综合,功率+阻力综合计算,功率${report.available_power_w.toFixed(3)}W; 总阻力${report.total_resistance_n.toFixed(4)}N`,
    ...warnings.map((w: any) => `预警:${escape(w.type)},${escape(w.message)},${escape(w.business_impact)},${escape(w.source_ids?.join('; '))},,`)
  ]

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename=estimation-${report.id}.csv`)
  res.send('\uFEFF' + rows.join('\n'))
})

router.post('/compare', (req: Request, res: Response) => {
  const db = getDb()
  const { report_id_a, report_id_b } = req.body
  if (!report_id_a || !report_id_b) {
    res.status(400).json({ success: false, error: '需要两个报告ID进行对比' })
    return
  }

  const ra = db.prepare('SELECT * FROM estimation_reports WHERE id = ?').get(report_id_a) as any
  const rb = db.prepare('SELECT * FROM estimation_reports WHERE id = ?').get(report_id_b) as any
  if (!ra || !rb) {
    res.status(404).json({ success: false, error: '报告不存在' })
    return
  }

  const carA = db.prepare('SELECT * FROM car_params WHERE id = ?').get(ra.car_params_id) as any
  const carB = db.prepare('SELECT * FROM car_params WHERE id = ?').get(rb.car_params_id) as any
  const trackA = db.prepare('SELECT * FROM track_params WHERE id = ?').get(ra.track_params_id) as any
  const trackB = db.prepare('SELECT * FROM track_params WHERE id = ?').get(rb.track_params_id) as any

  const fields = [
    { key: 'available_power_w', label: '可用功率(W)' },
    { key: 'slope_resistance_n', label: '坡度阻力(N)' },
    { key: 'rolling_resistance_n', label: '滚动阻力(N)' },
    { key: 'aero_resistance_n', label: '空气阻力(N)' },
    { key: 'total_resistance_n', label: '总阻力(N)' },
    { key: 'net_force_n', label: '净力(N)' },
    { key: 'estimated_time_s', label: '预估时间(s)' }
  ]

  const compare = fields.map(f => {
    const va = ra[f.key]
    const vb = rb[f.key]
    const diff = vb - va
    const pct = va !== 0 ? (diff / Math.abs(va)) * 100 : 0
    return {
      field: f.label,
      value_a: va,
      value_b: vb,
      diff,
      percent_change: pct,
      significant: Math.abs(pct) > 10
    }
  })

  const params = [
    { field: '小车名称', value_a: carA?.car_name, value_b: carB?.car_name, diff: '-', percent_change: 0, significant: false },
    { field: '质量(kg)', value_a: carA?.mass_kg, value_b: carB?.mass_kg, diff: (carB?.mass_kg ?? 0) - (carA?.mass_kg ?? 0), percent_change: 0, significant: false },
    { field: '电机效率(%)', value_a: carA?.motor_efficiency_percent, value_b: carB?.motor_efficiency_percent, diff: (carB?.motor_efficiency_percent ?? 0) - (carA?.motor_efficiency_percent ?? 0), percent_change: 0, significant: false },
    { field: '坡度(%)', value_a: trackA?.slope_percent, value_b: trackB?.slope_percent, diff: (trackB?.slope_percent ?? 0) - (trackA?.slope_percent ?? 0), percent_change: 0, significant: false },
    { field: '齿轮比', value_a: trackA?.gear_ratio, value_b: trackB?.gear_ratio, diff: (trackB?.gear_ratio ?? 0) - (trackA?.gear_ratio ?? 0), percent_change: 0, significant: false },
    ...compare
  ]

  res.json({
    success: true,
    data: {
      report_a: { ...ra, warnings: JSON.parse(ra.warnings_json || '[]'), light_record_ids: JSON.parse(ra.light_record_ids || '[]') },
      report_b: { ...rb, warnings: JSON.parse(rb.warnings_json || '[]'), light_record_ids: JSON.parse(rb.light_record_ids || '[]') },
      comparison: params
    }
  })
})

export default router
