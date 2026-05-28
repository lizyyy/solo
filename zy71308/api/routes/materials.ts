import { Router, type Request, type Response } from 'express'
import db from '../db.js'

const router = Router()

router.get('/', (req: Request, res: Response): void => {
  try {
    const materials = db.prepare('SELECT * FROM materials ORDER BY id').all()
    res.json({ success: true, data: materials })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

router.post('/', (req: Request, res: Response): void => {
  try {
    const { name, min_energy_density, max_energy_density, recommended_power, recommended_speed, focal_range_min, focal_range_max } = req.body
    if (!name) {
      res.status(400).json({ success: false, error: '材料名称不能为空' })
      return
    }
    const stmt = db.prepare(`
      INSERT INTO materials (name, min_energy_density, max_energy_density, recommended_power, recommended_speed, focal_range_min, focal_range_max)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    const result = stmt.run(name, min_energy_density, max_energy_density, recommended_power, recommended_speed, focal_range_min, focal_range_max)
    const material = db.prepare('SELECT * FROM materials WHERE id = ?').get(result.lastInsertRowid)
    res.json({ success: true, data: material })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

router.put('/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const existing = db.prepare('SELECT * FROM materials WHERE id = ?').get(id)
    if (!existing) {
      res.status(404).json({ success: false, error: '材料不存在' })
      return
    }
    const { name, min_energy_density, max_energy_density, recommended_power, recommended_speed, focal_range_min, focal_range_max } = req.body
    db.prepare(`
      UPDATE materials SET name = ?, min_energy_density = ?, max_energy_density = ?, recommended_power = ?, recommended_speed = ?, focal_range_min = ?, focal_range_max = ?
      WHERE id = ?
    `).run(
      name ?? (existing as any).name,
      min_energy_density ?? (existing as any).min_energy_density,
      max_energy_density ?? (existing as any).max_energy_density,
      recommended_power ?? (existing as any).recommended_power,
      recommended_speed ?? (existing as any).recommended_speed,
      focal_range_min ?? (existing as any).focal_range_min,
      focal_range_max ?? (existing as any).focal_range_max,
      id
    )
    const material = db.prepare('SELECT * FROM materials WHERE id = ?').get(id)
    res.json({ success: true, data: material })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

router.delete('/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const existing = db.prepare('SELECT * FROM materials WHERE id = ?').get(id)
    if (!existing) {
      res.status(404).json({ success: false, error: '材料不存在' })
      return
    }
    const recordCount = db.prepare('SELECT COUNT(*) as cnt FROM records WHERE material_id = ?').get(id) as { cnt: number }
    if (recordCount.cnt > 0) {
      res.status(400).json({ success: false, error: '该材料下有关联记录，无法删除' })
      return
    }
    db.prepare('DELETE FROM materials WHERE id = ?').run(id)
    res.json({ success: true, data: null })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

export default router
