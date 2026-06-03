/**
 * 安全半径表 API 路由
 */
import { Router, type Request, type Response } from 'express'
import type { SafetyRadius } from '../../shared/types.js'

const router = Router()

let radiusTable: SafetyRadius[] = [
  { id: 'SR-001', windDirection: 0, windSpeedMin: 0, windSpeedMax: 3, version: '2024', requiredRadius: 120, createdAt: '2024-01-01' },
  { id: 'SR-002', windDirection: 0, windSpeedMin: 3, windSpeedMax: 6, version: '2024', requiredRadius: 150, createdAt: '2024-01-01' },
  { id: 'SR-003', windDirection: 0, windSpeedMin: 6, windSpeedMax: 10, version: '2024', requiredRadius: 180, createdAt: '2024-01-01' },
  { id: 'SR-004', windDirection: 90, windSpeedMin: 0, windSpeedMax: 3, version: '2024', requiredRadius: 110, createdAt: '2024-01-01' },
  { id: 'SR-005', windDirection: 90, windSpeedMin: 3, windSpeedMax: 6, version: '2024', requiredRadius: 140, createdAt: '2024-01-01' },
  { id: 'SR-006', windDirection: 90, windSpeedMin: 6, windSpeedMax: 10, version: '2024', requiredRadius: 170, createdAt: '2024-01-01' },
  { id: 'SR-007', windDirection: 180, windSpeedMin: 0, windSpeedMax: 3, version: '2024', requiredRadius: 130, createdAt: '2024-01-01' },
  { id: 'SR-008', windDirection: 180, windSpeedMin: 3, windSpeedMax: 6, version: '2024', requiredRadius: 160, createdAt: '2024-01-01' },
  { id: 'SR-009', windDirection: 180, windSpeedMin: 6, windSpeedMax: 10, version: '2024', requiredRadius: 190, createdAt: '2024-01-01' },
  { id: 'SR-010', windDirection: 270, windSpeedMin: 0, windSpeedMax: 3, version: '2024', requiredRadius: 115, createdAt: '2024-01-01' },
  { id: 'SR-011', windDirection: 270, windSpeedMin: 3, windSpeedMax: 6, version: '2024', requiredRadius: 145, createdAt: '2024-01-01' },
  { id: 'SR-012', windDirection: 270, windSpeedMin: 6, windSpeedMax: 10, version: '2024', requiredRadius: 175, createdAt: '2024-01-01' },
  { id: 'SR-013', windDirection: 90, windSpeedMin: 0, windSpeedMax: 3, version: '2023', requiredRadius: 150, createdAt: '2023-01-01' },
  { id: 'SR-014', windDirection: 90, windSpeedMin: 3, windSpeedMax: 6, version: '2023', requiredRadius: 180, createdAt: '2023-01-01' },
  { id: 'SR-015', windDirection: 90, windSpeedMin: 6, windSpeedMax: 10, version: '2023', requiredRadius: 220, createdAt: '2023-01-01' },
  { id: 'SR-016', windDirection: 180, windSpeedMin: 3, windSpeedMax: 6, version: '2023', requiredRadius: 200, createdAt: '2023-01-01' }
]

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const { version } = req.query
  let data = radiusTable
  if (version) {
    data = radiusTable.filter(r => r.version === version)
  }
  res.status(200).json({
    success: true,
    data
  })
})

router.get('/lookup', async (req: Request, res: Response): Promise<void> => {
  const { windDirection, windSpeed, version = '2024' } = req.query
  const dir = parseInt(windDirection as string)
  const speed = parseFloat(windSpeed as string)
  
  const normalizedDir = Math.round(dir / 90) * 90 % 360
  
  const record = radiusTable.find(
    r => r.windDirection === normalizedDir && 
         r.windSpeedMin <= speed && 
         r.windSpeedMax > speed && 
         r.version === version
  )
  
  if (!record) {
    const defaultRecord = radiusTable.find(
      r => r.windDirection === 0 && 
           r.windSpeedMin <= speed && 
           r.windSpeedMax > speed && 
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
    res.status(404).json({
      success: false,
      error: '未找到匹配的安全半径记录'
    })
    return
  }
  
  res.status(200).json({
    success: true,
    data: record
  })
})

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const newRecord: SafetyRadius = {
    id: `SR-${String(radiusTable.length + 1).padStart(3, '0')}`,
    ...req.body,
    createdAt: new Date().toISOString()
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
    id: `SR-${String(radiusTable.length + 1).padStart(3, '0')}`,
    version: toVersion,
    requiredRadius: Math.round(r.requiredRadius * 0.8),
    createdAt: new Date().toISOString()
  }))
  
  radiusTable.push(...newRecords)
  
  res.status(201).json({
    success: true,
    data: newRecords,
    message: `已从${fromVersion}版同步${newRecords.length}条记录到${toVersion}版，新口径已按80%调整`
  })
})

export default router
