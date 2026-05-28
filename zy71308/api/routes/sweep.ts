import { Router, type Request, type Response } from 'express'
import db from '../db.js'

const router = Router()

interface Material {
  id: number
  name: string
  min_energy_density: number
  max_energy_density: number
  recommended_power: number
  recommended_speed: number
  focal_range_min: number
  focal_range_max: number
}

router.post('/', (req: Request, res: Response): void => {
  try {
    const {
      material_id,
      sweep_variable,
      range_min,
      range_max,
      step,
      fixed_power,
      fixed_speed,
      fixed_focal_length,
      line_width,
    } = req.body

    if (!material_id || !sweep_variable || range_min == null || range_max == null || step == null || line_width == null) {
      res.status(400).json({ success: false, error: '缺少必要参数' })
      return
    }

    const material = db.prepare('SELECT * FROM materials WHERE id = ?').get(material_id) as Material | undefined
    if (!material) {
      res.status(404).json({ success: false, error: '材料不存在' })
      return
    }

    const points: { value: number; energy_density: number; risk_level: string }[] = []

    for (let value = range_min; value <= range_max + step * 0.001; value += step) {
      const v = Math.round(value * 10000) / 10000
      if (v > range_max) break

      let power = fixed_power ?? 0
      let speed = fixed_speed ?? 0
      let focal = fixed_focal_length ?? 0

      if (sweep_variable === 'power') power = v
      else if (sweep_variable === 'speed') speed = v
      else if (sweep_variable === 'focal_length') focal = v

      const energy_density = speed > 0 && line_width > 0 ? power / (speed * line_width) : 0

      let risk_level = 'safe'
      const errors: string[] = []
      const warnings: string[] = []

      if (power < 0 || power > 100) errors.push('power')
      if (speed <= 0 || speed > 10000) errors.push('speed')
      if (focal < material.focal_range_min || focal > material.focal_range_max) errors.push('focal')

      if (errors.length === 0) {
        if (energy_density < material.min_energy_density) warnings.push('low')
        if (energy_density > material.max_energy_density) warnings.push('high')
      }

      if (errors.length > 0) risk_level = 'danger'
      else if (warnings.length > 0) risk_level = 'warning'

      points.push({ value: v, energy_density, risk_level })
    }

    res.json({ success: true, data: { variable: sweep_variable, points } })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

export default router
