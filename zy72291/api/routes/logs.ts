/**
 * 点云抽稀日志 API 路由
 */
import { Router, type Request, type Response } from 'express'
import type { PointCloudLog, ManualCorrection } from '../../shared/types.js'

const router = Router()

let logs: PointCloudLog[] = [
  {
    id: 'LOG-001',
    batchNo: 'PC-2024-12-001',
    status: 'success',
    source: 'airborne_lidar',
    captureTime: '2024-12-15T08:30:00',
    importTime: '2024-12-15T10:15:00',
    pointCount: 12500000,
    thinningRatio: 0.85,
    hasScreenshotOcclusion: false,
    occlusionArea: 0,
    windDirection: 180,
    windSpeed: 4.5,
    measuredDistance: 185,
    rerunCount: 0,
    operator: '许工',
    notes: '机载LiDAR扫描，数据质量良好，无遮挡',
    alerts: [
      { id: 'ALT-001', type: 'info', message: '点云密度符合要求', timestamp: '2024-12-15T10:16:00' }
    ]
  },
  {
    id: 'LOG-002',
    batchNo: 'PC-2024-12-002',
    status: 'pending_review',
    source: 'mobile_inspection',
    captureTime: '2024-12-15T09:45:00',
    importTime: '2024-12-15T11:20:00',
    pointCount: 8200000,
    thinningRatio: 0.72,
    hasScreenshotOcclusion: true,
    occlusionArea: 40,
    windDirection: 270,
    windSpeed: 6.2,
    measuredDistance: 88,
    rerunCount: 0,
    operator: '许工',
    notes: '移动端巡检，告警标签被截图遮挡约40%，待施工经理复核',
    alerts: [
      { id: 'ALT-002', type: 'warning', message: '检测到移动端截图遮挡', timestamp: '2024-12-15T11:21:00' },
      { id: 'ALT-003', type: 'warning', message: '告警标签部分不可见，已标记待复核', timestamp: '2024-12-15T11:21:30' }
    ]
  },
  {
    id: 'LOG-003',
    batchNo: 'PC-2024-12-003',
    status: 'legacy',
    source: 'historical_data',
    captureTime: '2023-06-20T14:00:00',
    importTime: '2024-12-15T14:30:00',
    pointCount: 6800000,
    thinningRatio: 0.68,
    hasScreenshotOcclusion: false,
    occlusionArea: 0,
    windDirection: 90,
    windSpeed: 3.8,
    measuredDistance: 195,
    rerunCount: 1,
    operator: '许工',
    notes: '2023年历史数据，已从旧口径安全半径表补录，含1次人工修正和1次重跑',
    alerts: [
      { id: 'ALT-004', type: 'info', message: '使用2023旧口径安全半径标准', timestamp: '2024-12-15T14:31:00' },
      { id: 'ALT-005', type: 'info', message: '已完成人工修正并重跑', timestamp: '2024-12-15T14:45:00' }
    ],
    manualCorrections: [
      {
        id: 'CORR-001',
        logId: 'LOG-003',
        field: 'windDirection',
        oldValue: 85,
        newValue: 90,
        operator: '许工',
        timestamp: '2024-12-15T14:35:00',
        reason: '现场风向记录与历史数据存在5度偏差，经核实修正为90度'
      }
    ]
  }
]

router.get('/', async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({
    success: true,
    data: logs
  })
})

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const log = logs.find(l => l.id === req.params.id)
  if (!log) {
    res.status(404).json({
      success: false,
      error: '日志不存在'
    })
    return
  }
  res.status(200).json({
    success: true,
    data: log
  })
})

router.post('/import', async (req: Request, res: Response): Promise<void> => {
  const { fileData, fileName } = req.body
  const newLog: PointCloudLog = {
    id: `LOG-${String(logs.length + 1).padStart(3, '0')}`,
    batchNo: `PC-2024-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
    status: 'pending',
    source: 'airborne_lidar',
    captureTime: new Date().toISOString(),
    importTime: new Date().toISOString(),
    pointCount: Math.floor(Math.random() * 10000000) + 5000000,
    thinningRatio: Math.random() * 0.3 + 0.6,
    hasScreenshotOcclusion: false,
    occlusionArea: 0,
    windDirection: Math.floor(Math.random() * 360),
    windSpeed: Math.random() * 8 + 2,
    measuredDistance: Math.floor(Math.random() * 100) + 100,
    rerunCount: 0,
    operator: '许工',
    notes: `导入文件: ${fileName || '未知'}`,
    alerts: []
  }
  
  if (Math.random() > 0.7) {
    newLog.hasScreenshotOcclusion = true
    newLog.occlusionArea = Math.floor(Math.random() * 50) + 10
    newLog.status = 'pending_review'
    newLog.alerts.push({
      id: `ALT-${Date.now()}`,
      type: 'warning',
      message: `检测到移动端截图遮挡，遮挡面积约${newLog.occlusionArea}%`,
      timestamp: new Date().toISOString()
    })
    newLog.alerts.push({
      id: `ALT-${Date.now() + 1}`,
      type: 'warning',
      message: '告警标签部分不可见，已标记待施工经理复核',
      timestamp: new Date().toISOString()
    })
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
    res.status(404).json({
      success: false,
      error: '日志不存在'
    })
    return
  }
  
  logs[logIndex].status = status
  if (note) {
    logs[logIndex].notes += ` | ${note}`
  }
  if (reviewedBy) {
    logs[logIndex].alerts.push({
      id: `ALT-${Date.now()}`,
      type: 'info',
      message: `施工经理${reviewedBy}已复核`,
      timestamp: new Date().toISOString()
    })
  }
  
  res.status(200).json({
    success: true,
    data: logs[logIndex]
  })
})

router.post('/:id/correction', async (req: Request, res: Response): Promise<void> => {
  const correction: ManualCorrection = req.body
  const logIndex = logs.findIndex(l => l.id === req.params.id)
  
  if (logIndex === -1) {
    res.status(404).json({
      success: false,
      error: '日志不存在'
    })
    return
  }
  
  if (!logs[logIndex].manualCorrections) {
    logs[logIndex].manualCorrections = []
  }
  
  correction.id = `CORR-${Date.now()}`
  correction.logId = req.params.id
  correction.timestamp = new Date().toISOString()
  
  logs[logIndex].manualCorrections.push(correction)
  logs[logIndex].notes += ` | 人工修正: ${correction.field} ${correction.oldValue}→${correction.newValue}`
  
  res.status(201).json({
    success: true,
    data: correction
  })
})

router.post('/:id/rerun', async (req: Request, res: Response): Promise<void> => {
  const logIndex = logs.findIndex(l => l.id === req.params.id)
  
  if (logIndex === -1) {
    res.status(404).json({
      success: false,
      error: '日志不存在'
    })
    return
  }
  
  logs[logIndex].rerunCount += 1
  logs[logIndex].alerts.push({
    id: `ALT-${Date.now()}`,
    type: 'info',
    message: `第${logs[logIndex].rerunCount}次重跑分析`,
    timestamp: new Date().toISOString()
  })
  
  res.status(200).json({
    success: true,
    data: logs[logIndex],
    rerunCount: logs[logIndex].rerunCount
  })
})

export default router
