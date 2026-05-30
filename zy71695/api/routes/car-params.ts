import { Router, type Request, type Response } from 'express'
import { getDb } from '../db.js'
import { randomUUID } from 'crypto'

const router = Router()

router.get('/', (req: Request, res: Response) => {
  const db = getDb()
  const projectId = req.query.project_id as string
  if (!projectId) {
    res.status(400).json({ success: false, error: 'project_id 必填' })
    return
  }
  const rows = db.prepare('SELECT * FROM car_params WHERE project_id = ? ORDER BY created_at DESC').all(projectId)
  res.json({ success: true, data: rows })
})

router.post('/', (req: Request, res: Response) => {
  const db = getDb()
  const id = randomUUID()
  const {
    project_id, car_name, mass_kg, motor_voltage_v, motor_rpm,
    motor_power_w, motor_efficiency_percent, panel_area_m2,
    panel_efficiency_percent, wheel_diameter_m
  } = req.body
  if (!project_id) {
    res.status(400).json({ success: false, error: 'project_id 必填' })
    return
  }
  db.prepare(`INSERT INTO car_params (id, project_id, car_name, mass_kg, motor_voltage_v, motor_rpm, motor_power_w, motor_efficiency_percent, panel_area_m2, panel_efficiency_percent, wheel_diameter_m)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, project_id, car_name || '默认小车', mass_kg ?? 0.5, motor_voltage_v ?? 6, motor_rpm ?? 3000,
      motor_power_w ?? 2, motor_efficiency_percent ?? 60, panel_area_m2 ?? 0.03,
      panel_efficiency_percent ?? 20, wheel_diameter_m ?? 0.06)
  const row = db.prepare('SELECT * FROM car_params WHERE id = ?').get(id)
  res.json({ success: true, data: row })
})

router.put('/:id', (req: Request, res: Response) => {
  const db = getDb()
  const {
    car_name, mass_kg, motor_voltage_v, motor_rpm,
    motor_power_w, motor_efficiency_percent, panel_area_m2,
    panel_efficiency_percent, wheel_diameter_m
  } = req.body
  db.prepare(`UPDATE car_params SET car_name = ?, mass_kg = ?, motor_voltage_v = ?, motor_rpm = ?, motor_power_w = ?,
    motor_efficiency_percent = ?, panel_area_m2 = ?, panel_efficiency_percent = ?, wheel_diameter_m = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(car_name, mass_kg, motor_voltage_v, motor_rpm, motor_power_w,
      motor_efficiency_percent, panel_area_m2, panel_efficiency_percent, wheel_diameter_m, req.params.id)
  const row = db.prepare('SELECT * FROM car_params WHERE id = ?').get(req.params.id)
  res.json({ success: true, data: row })
})

router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb()
  db.prepare('DELETE FROM car_params WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

export default router
