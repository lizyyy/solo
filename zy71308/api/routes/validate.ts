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

export function runValidation(material_id: number, laser_power: number, move_speed: number, focal_length: number, line_width: number) {
  const material = db.prepare('SELECT * FROM materials WHERE id = ?').get(material_id) as Material | undefined
  if (!material) {
    throw new Error('材料不存在')
  }

  const energy_density = move_speed > 0 && line_width > 0
    ? laser_power / (move_speed * line_width)
    : 0

  const errors: string[] = []
  const warnings: string[] = []
  const suggestions: string[] = []

  if (laser_power < 0) errors.push(`激光功率 ${laser_power}W 为负数，不合法`)
  if (laser_power > 100) errors.push(`激光功率 ${laser_power}W 超出设备范围 0-100W`)
  if (move_speed === 0) errors.push('移动速度不能为0，将导致驻留烧穿')
  if (move_speed < 0) errors.push('移动速度不能为负值')
  if (move_speed > 10000) errors.push(`移动速度 ${move_speed} mm/s 疑似单位错误，是否应输入 ${(move_speed / 60).toFixed(1)} mm/s？`)
  if (line_width === 0) errors.push('线宽不能为0，将导致能量密度无穷大')
  if (line_width < 0) errors.push('线宽不能为负值')
  if (focal_length < material.focal_range_min || focal_length > material.focal_range_max) {
    errors.push(`焦距 ${focal_length}mm 超出${material.name}适用范围 ${material.focal_range_min}-${material.focal_range_max}mm`)
  }

  if (errors.length === 0) {
    if (energy_density < material.min_energy_density) {
      warnings.push(`能量密度(${energy_density.toFixed(4)})低于材料阈值(${material.min_energy_density})`)
    }
    if (energy_density > material.max_energy_density) {
      warnings.push(`能量密度(${energy_density.toFixed(4)})高于材料阈值(${material.max_energy_density})`)
    }
    if (laser_power > 80) warnings.push('功率偏高(>80W)')
    if (move_speed < 10 && move_speed > 0) warnings.push('速度偏低(<10)')

    const powerDeviation = Math.abs(laser_power - material.recommended_power) / material.recommended_power
    const speedDeviation = Math.abs(move_speed - material.recommended_speed) / material.recommended_speed
    if (powerDeviation > 0.5) suggestions.push(`功率偏离推荐值超过50%`)
    if (speedDeviation > 0.5) suggestions.push(`速度偏离推荐值超过50%`)
  }

  let risk_level: string
  if (errors.length > 0) risk_level = 'danger'
  else if (warnings.length > 0) risk_level = 'warning'
  else risk_level = 'safe'

  return { energy_density, risk_level, errors, warnings, suggestions, material }
}

router.post('/', (req: Request, res: Response): void => {
  try {
    const { material_id, laser_power, move_speed, focal_length, line_width } = req.body
    if (material_id == null || laser_power == null || move_speed == null || focal_length == null || line_width == null) {
      res.status(400).json({ success: false, error: '缺少必要参数' })
      return
    }
    const result = runValidation(material_id, laser_power, move_speed, focal_length, line_width)
    res.json({
      success: true,
      data: {
        energy_density: result.energy_density,
        risk_level: result.risk_level,
        errors: result.errors,
        warnings: result.warnings,
        suggestions: result.suggestions,
      },
    })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

export default router
