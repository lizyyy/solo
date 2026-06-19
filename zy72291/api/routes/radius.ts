import { Router, type Request, type Response } from 'express'
import type { SafetyRadius, RadiusVersion, WindSpeed } from '../../shared/types.js'
import { state } from '../store.js'

const router = Router()

function speedToWindSpeed(speed: number): WindSpeed {
  if (speed < 6) return 'low'
  if (speed < 12) return 'medium'
  return 'high'
}

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const { version } = req.query
  let data = state.radiusTable
  if (version) {
    data = state.radiusTable.filter(r => r.version === version)
  }
  res.status(200).json({ success: true, data })
})

router.get('/lookup', async (req: Request, res: Response): Promise<void> => {
  const { windDirection, windSpeed, version = 'new' } = req.query
  const dir = parseInt(windDirection as string)
  const speed = parseFloat(windSpeed as string)

  const normalizedDir = Math.round(dir / 45) * 45 % 360
  const windSpeedLevel = speedToWindSpeed(speed)

  const record = state.radiusTable.find(
    r => r.windDirection === normalizedDir &&
         r.windSpeed === windSpeedLevel &&
         r.version === version
  )

  if (!record) {
    const defaultRecord = state.radiusTable.find(
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
    id: `R-${String(state.radiusTable.length + 1).padStart(3, '0')}`,
    windDirection: req.body.windDirection,
    windSpeed: req.body.windSpeed as WindSpeed,
    radius: req.body.radius,
    version: req.body.version as RadiusVersion,
    effectiveDate: req.body.effectiveDate || new Date().toISOString().split('T')[0],
    source: req.body.source || '人工补录',
  }
  state.radiusTable.push(newRecord)

  res.status(201).json({
    success: true,
    data: newRecord,
    message: '安全半径记录已添加，安全距离报告将自动更新'
  })
})

router.post('/sync', async (req: Request, res: Response): Promise<void> => {
  const { fromVersion, toVersion } = req.body
  const sourceRecords = state.radiusTable.filter(r => r.version === fromVersion)
  const newRecords = sourceRecords.map(r => ({
    ...r,
    id: `R-${String(state.radiusTable.length + 1).padStart(3, '0')}`,
    version: toVersion as RadiusVersion,
    radius: Math.round(r.radius * 0.8),
    effectiveDate: new Date().toISOString().split('T')[0],
  }))

  state.radiusTable.push(...(newRecords as SafetyRadius[]))

  res.status(201).json({
    success: true,
    data: newRecords,
    message: `已从${fromVersion}版同步${newRecords.length}条记录到${toVersion}版，新口径已按80%调整`
  })
})

export default router
