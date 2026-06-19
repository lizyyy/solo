import { Router, type Request, type Response } from 'express'
import type { PointCloudLog, ManualCorrection } from '../../shared/types.js'
import { state, resetState, buildSafetyReport } from '../store.js'

const router = Router()

router.get('/', async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: state.logs })
})

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const log = state.logs.find((l: PointCloudLog): boolean => l.id === req.params.id)
  if (!log) {
    res.status(404).json({ success: false, error: '日志不存在' })
    return
  }
  res.status(200).json({ success: true, data: log })
})

router.post('/import', async (req: Request, res: Response): Promise<void> => {
  const { fileName } = req.body
  const hasOcclusion = Math.random() > 0.6
  const newLog: PointCloudLog = {
    id: `LOG-${String(state.logs.length + 1).padStart(3, '0')}`,
    batchNo: `PC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Math.floor(Math.random() * 10)).padStart(2, '0')}`,
    timestamp: new Date().toISOString(),
    pointCount: Math.floor(Math.random() * 500000) + 900000,
    thinningRate: 0.8 + Math.random() * 0.1,
    status: hasOcclusion ? 'pending_review' : 'success',
    source: '导入',
    hasScreenshotOcclusion: hasOcclusion,
    screenshotNote: hasOcclusion ? '检测到疑似截图遮挡，需人工确认' : undefined,
    rerunCount: 0,
    windDirection: Math.floor(Math.random() * 360),
    windSpeed: Math.random() * 8 + 2,
    measuredDistance: Math.floor(Math.random() * 100) + 100,
    occlusionArea: hasOcclusion ? Math.floor(Math.random() * 50) + 10 : 0,
    operator: '许工',
    notes: `导入文件: ${fileName || '未知'}`,
    alerts: hasOcclusion
      ? [
          { id: `A-${Date.now()}`, type: 'occlusion' as const, level: 'warning' as const, message: `检测到移动端截图遮挡，遮挡面积约${Math.floor(Math.random() * 50) + 10}%`, isOccluded: true, position: { x: 0, y: 0, z: 0 } },
          { id: `A-${Date.now() + 1}`, type: 'distance' as const, level: 'danger' as const, message: '告警标签部分不可见，已标记待施工经理复核', isOccluded: true, position: { x: 0, y: 0, z: 0 } }
        ]
      : []
  }

  state.logs.unshift(newLog)

  res.status(201).json({
    success: true,
    data: newLog,
    message: newLog.hasScreenshotOcclusion
      ? '导入成功，检测到截图遮挡，已标记待复核'
      : '导入成功'
  })
})

router.put('/:id/status', async (req: Request, res: Response): Promise<void> => {
  const { status, note, reviewedBy } = req.body
  const logIndex = state.logs.findIndex((l: PointCloudLog): boolean => l.id === req.params.id)

  if (logIndex === -1) {
    res.status(404).json({ success: false, error: '日志不存在' })
    return
  }

  state.logs[logIndex] = { ...state.logs[logIndex], status }
  if (note) {
    state.logs[logIndex].notes = `${state.logs[logIndex].notes || ''} | ${note}`
  }
  if (reviewedBy) {
    state.logs[logIndex].alerts.push({
      id: `A-${Date.now()}`,
      type: 'distance',
      level: 'info',
      message: `施工经理${reviewedBy}已复核`,
      isOccluded: false,
      position: { x: 0, y: 0, z: 0 }
    })
  }

  res.status(200).json({ success: true, data: state.logs[logIndex] })
})

router.post('/:id/correction', async (req: Request, res: Response): Promise<void> => {
  const correction: ManualCorrection = req.body
  const logIndex = state.logs.findIndex((l: PointCloudLog): boolean => l.id === req.params.id)

  if (logIndex === -1) {
    res.status(404).json({ success: false, error: '日志不存在' })
    return
  }

  if (!state.logs[logIndex].manualCorrections) {
    state.logs[logIndex].manualCorrections = []
  }

  correction.id = `CORR-${Date.now()}`
  correction.logId = req.params.id
  correction.timestamp = new Date().toISOString()

  state.logs[logIndex].manualCorrections!.push(correction)
  state.logs[logIndex].manualCorrection = `${correction.field}: ${correction.oldValue}→${correction.newValue} (${correction.reason})`
  state.logs[logIndex].notes = `${state.logs[logIndex].notes || ''} | 人工修正: ${correction.field} ${correction.oldValue}→${correction.newValue}`

  res.status(201).json({ success: true, data: correction })
})

router.post('/:id/rerun', async (req: Request, res: Response): Promise<void> => {
  const logIndex = state.logs.findIndex((l: PointCloudLog): boolean => l.id === req.params.id)

  if (logIndex === -1) {
    res.status(404).json({ success: false, error: '日志不存在' })
    return
  }

  state.logs[logIndex] = { ...state.logs[logIndex], rerunCount: state.logs[logIndex].rerunCount + 1 }
  state.logs[logIndex].alerts.push({
    id: `A-${Date.now()}`,
    type: 'distance',
    level: 'info',
    message: `第${state.logs[logIndex].rerunCount}次重跑分析`,
    isOccluded: false,
    position: { x: 0, y: 0, z: 0 }
  })

  res.status(200).json({ success: true, data: state.logs[logIndex], rerunCount: state.logs[logIndex].rerunCount })
})

export { resetState, buildSafetyReport }
export default router
