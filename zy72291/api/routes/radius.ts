import { Router, type Request, type Response } from 'express'
import type { SafetyRadius, RadiusVersion, WindSpeed } from '../../shared/types.js'

const router = Router()

let radiusTable: SafetyRadius[] = [
  { id: 'R-001', windDirection: 0, windSpeed: 'low', radius: 150, version: 'new', effectiveDate: '2024-01-01', source: 'GB 2024-滑翔伞场地规范' },
  { id: 'R-002', windDirection: 0, windSpeed: 'low', radius: 120, version: 'legacy', effectiveDate: '2023-01-01', source: 'GB 2023-滑翔伞场地规范' },
  { id: 'R-003', windDirection: 45, windSpeed: 'medium', radius: 200, version: 'new', effectiveDate: '2024-01-01', source: 'GB 2024-滑翔伞场地规范' },
  { id: 'R-004', windDirection: 45, windSpeed: 'medium', radius: 160, version: 'legacy', effectiveDate: '2023-01-01', source: 'GB 2023-滑翔伞场地规范' },
  { id: 'R-005', windDirection: 90, windSpeed: 'high', radius: 280, version: 'new', effectiveDate: '2024-01-01', source: 'GB 2024-滑翔伞场地规范' },
  { id: 'R-006', windDirection: 90, windSpeed: 'high', radius: 220, version: 'legacy', effectiveDate: '2023-01-01', source: 'GB 2023-滑翔伞场地规范' },
  { id: 'R-007', windDirection: 135, windSpeed: 'medium', radius: 220, version: 'new', effectiveDate: '2024-01-01', source: 'GB 2024-滑翔伞场地规范' },
  { id: 'R-008', windDirection: 135, windSpeed: 'medium', radius: 180, version: 'legacy', effectiveDate: '2023-01-01', source: 'GB 2023-滑翔伞场地规范' },
  { id: 'R-009', windDirection: 180, windSpeed: 'low', radius: 180, version: 'new', effectiveDate: '2024-01-01', source: 'GB 2024-滑翔伞场地规范' },
  { id: 'R-010', windDirection: 180, windSpeed: 'low', radius: 140, version: 'legacy', effectiveDate: '2023-01-01', source: 'GB 2023-滑翔伞场地规范' },
  { id: 'R-011', windDirection: 225, windSpeed: 'medium', radius: 240, version: 'new', effectiveDate: '2024-01-01', source: 'GB 2024-滑翔伞场地规范' },
  { id: 'R-012', windDirection: 225, windSpeed: 'medium', radius: 200, version: 'legacy', effectiveDate: '2023-01-01', source: 'GB 2023-滑翔伞场地规范' },
  { id: 'R-013', windDirection: 270, windSpeed: 'high', radius: 300, version: 'new', effectiveDate: '2024-01-01', source: 'GB 2024-滑翔伞场地规范' },
  { id: 'R-014', windDirection: 270, windSpeed: 'high', radius: 240, version: 'legacy', effectiveDate: '2023-01-01', source: 'GB 2023-滑翔伞场地规范' },
  { id: 'R-015', windDirection: 315, windSpeed: 'medium', radius: 210, version: 'new', effectiveDate: '2024-01-01', source: 'GB 2024-滑翔伞场地规范' },
  { id: 'R-016', windDirection: 315, windSpeed: 'medium', radius: 170, version: 'legacy', effectiveDate: '2023-01-01', source: 'GB 2023-滑翔伞场地规范' },
]

function speedToWindSpeed(speed: number): WindSpeed {
  if (speed < 6) return 'low'
  if (speed < 12) return 'medium'
  return 'high'
}

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const { version } = req.query
  let data = radiusTable
  if (version) {
    data = radiusTable.filter(r => r.version === version)
  }
  res.status(200).json({ success: true, data })
})

router.get('/lookup', async (req: Request, res: Response): Promise<void> => {
  const { windDirection, windSpeed, version = 'new' } = req.query
  const dir = parseInt(windDirection as string)
  const speed = parseFloat(windSpeed as string)

  const normalizedDir = Math.round(dir / 45) * 45 % 360
  const windSpeedLevel = speedToWindSpeed(speed)

  const record = radiusTable.find(
    r => r.windDirection === normalizedDir &&
         r.windSpeed === windSpeedLevel &&
         r.version === version
  )

  if (!record) {
    const defaultRecord = radiusTable.find(
      r => r.windDirection === 0 &&
           r.windSpeed === windSpeedLevel &&
           r.version === version
    )
    if (defaultRecord) {
      res.status(200).json({
        success: true,
        data: defaultRecord,
        note: '未找到精确匹配，使用默认风向数据'
      })
      return
    }
    res.status(404).json({ success: false, error: '未找到匹配的安全半径记录' })
    return
  }

  res.status(200).json({ success: true, data: record })
})

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const newRecord: SafetyRadius = {
    id: `R-${String(radiusTable.length + 1).padStart(3, '0')}`,
    windDirection: req.body.windDirection,
    windSpeed: req.body.windSpeed as WindSpeed,
    radius: req.body.radius,
    version: req.body.version as RadiusVersion,
    effectiveDate: req.body.effectiveDate || new Date().toISOString().split('T')[0],
    source: req.body.source || '人工补录',
  }
  radiusTable.push(newRecord)

  res.status(201).json({
    success: true,
    data: newRecord,
    message: '安全半径记录已添加，安全距离报告将自动更新'
  })
})

router.post('/sync', async (req: Request, res: Response): Promise<void> => {
  const { fromVersion, toVersion } = req.body
  const sourceRecords = radiusTable.filter(r => r.version === fromVersion)
  const newRecords = sourceRecords.map(r => ({
    ...r,
    id: `R-${String(radiusTable.length + 1).padStart(3, '0')}`,
    version: toVersion as RadiusVersion,
    radius: Math.round(r.radius * 0.8),
    effectiveDate: new Date().toISOString().split('T')[0],
  }))

  radiusTable.push(...(newRecords as SafetyRadius[]))

  res.status(201).json({
    success: true,
    data: newRecords,
    message: `已从${fromVersion}版同步${newRecords.length}条记录到${toVersion}版，新口径已按80%调整`
  })
})

export default router
