import { Router, type Request, type Response } from 'express'
import type { PointCloudLog, ManualCorrection } from '../../shared/types.js'

const router = Router()

let logs: PointCloudLog[] = [
  {
    id: 'LOG-001',
    batchNo: 'PC-2024-0615-A',
    timestamp: '2024-06-15T08:30:00',
    pointCount: 1250000,
    thinningRate: 0.85,
    status: 'success',
    source: '机载LiDAR',
    hasScreenshotOcclusion: false,
    rerunCount: 0,
    windDirection: 180,
    windSpeed: 4.5,
    measuredDistance: 185,
    operator: '许工',
    notes: '机载LiDAR扫描，数据质量良好，无遮挡',
    alerts: [
      { id: 'A-001', type: 'distance', level: 'info', message: '北侧障碍物距离正常，实测185米，要求150米', isOccluded: false, position: { x: 120, y: 80, z: 45 } }
    ]
  },
  {
    id: 'LOG-002',
    batchNo: 'PC-2024-0615-B',
    timestamp: '2024-06-15T14:20:00',
    pointCount: 980000,
    thinningRate: 0.82,
    status: 'pending_review',
    source: '移动端巡检',
    hasScreenshotOcclusion: true,
    screenshotNote: '告警标签区域被移动端截图水印遮挡约40%，东北方向距离读数存疑，需施工经理复核原始数据',
    rerunCount: 0,
    windDirection: 270,
    windSpeed: 6.2,
    measuredDistance: 88,
    occlusionArea: 40,
    operator: '许工',
    notes: '移动端巡检，告警标签被截图遮挡约40%，待施工经理复核',
    alerts: [
      { id: 'A-002', type: 'distance', level: 'danger', message: '东北方向安全距离不足，实测88米，要求200米', isOccluded: true, position: { x: 95, y: -110, z: 38 } },
      { id: 'A-003', type: 'obstacle', level: 'warning', message: '高压塔位置标记存疑，坐标偏差约12米', isOccluded: false, position: { x: 80, y: -90, z: 52 } }
    ]
  },
  {
    id: 'LOG-003',
    batchNo: 'PC-2024-0614-A',
    timestamp: '2024-06-14T16:45:00',
    pointCount: 1120000,
    thinningRate: 0.88,
    status: 'legacy',
    source: '历史数据补录',
    hasScreenshotOcclusion: false,
    rerunCount: 1,
    manualCorrection: '从2023版安全半径表补录旧口径数据，原记录缺失风速>12m/s工况参数',
    windDirection: 90,
    windSpeed: 3.8,
    measuredDistance: 195,
    operator: '许工',
    notes: '2023年历史数据，已从旧口径安全半径表补录，含1次人工修正和1次重跑',
    alerts: [
      { id: 'A-004', type: 'height', level: 'warning', message: '相对高度按2023旧口径计算，安全裕度降低20%', isOccluded: false, position: { x: -60, y: 130, z: 41 } }
    ],
    manualCorrections: [
      {
        id: 'CORR-001',
        logId: 'LOG-003',
        field: 'windDirection',
        oldValue: 85,
        newValue: 90,
        operator: '许工',
        timestamp: '2024-06-15T14:35:00',
        reason: '现场风向记录与历史数据存在5度偏差，经核实修正为90度'
      }
    ]
  }
]

router.get('/', async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: logs })
})

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const log = logs.find(l => l.id === req.params.id)
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
    id: `LOG-${String(logs.length + 1).padStart(3, '0')}`,
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

  logs.unshift(newLog)

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
  const logIndex = logs.findIndex(l => l.id === req.params.id)

  if (logIndex === -1) {
    res.status(404).json({ success: false, error: '日志不存在' })
    return
  }

  logs[logIndex] = { ...logs[logIndex], status }
  if (note) {
    logs[logIndex].notes = `${logs[logIndex].notes || ''} | ${note}`
  }
  if (reviewedBy) {
    logs[logIndex].alerts.push({
      id: `A-${Date.now()}`,
      type: 'distance',
      level: 'info',
      message: `施工经理${reviewedBy}已复核`,
      isOccluded: false,
      position: { x: 0, y: 0, z: 0 }
    })
  }

  res.status(200).json({ success: true, data: logs[logIndex] })
})

router.post('/:id/correction', async (req: Request, res: Response): Promise<void> => {
  const correction: ManualCorrection = req.body
  const logIndex = logs.findIndex(l => l.id === req.params.id)

  if (logIndex === -1) {
    res.status(404).json({ success: false, error: '日志不存在' })
    return
  }

  if (!logs[logIndex].manualCorrections) {
    logs[logIndex].manualCorrections = []
  }

  correction.id = `CORR-${Date.now()}`
  correction.logId = req.params.id
  correction.timestamp = new Date().toISOString()

  logs[logIndex].manualCorrections!.push(correction)
  logs[logIndex].manualCorrection = `${correction.field}: ${correction.oldValue}→${correction.newValue} (${correction.reason})`
  logs[logIndex].notes = `${logs[logIndex].notes || ''} | 人工修正: ${correction.field} ${correction.oldValue}→${correction.newValue}`

  res.status(201).json({ success: true, data: correction })
})

router.post('/:id/rerun', async (req: Request, res: Response): Promise<void> => {
  const logIndex = logs.findIndex(l => l.id === req.params.id)

  if (logIndex === -1) {
    res.status(404).json({ success: false, error: '日志不存在' })
    return
  }

  logs[logIndex] = { ...logs[logIndex], rerunCount: logs[logIndex].rerunCount + 1 }
  logs[logIndex].alerts.push({
    id: `A-${Date.now()}`,
    type: 'distance',
    level: 'info',
    message: `第${logs[logIndex].rerunCount}次重跑分析`,
    isOccluded: false,
    position: { x: 0, y: 0, z: 0 }
  })

  res.status(200).json({ success: true, data: logs[logIndex], rerunCount: logs[logIndex].rerunCount })
})

export default router
