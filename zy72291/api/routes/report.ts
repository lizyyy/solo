/**
 * 安全距离报告 API 路由
 */
import { Router, type Request, type Response } from 'express'
import type { SafetyReport, PointCloudLog, SafetyRadius, ReportItem } from '../../shared/types.js'

const router = Router()

function calculateCompliance(measured: number, required: number, status: string): string {
  if (status === 'pending_review') return 'pending'
  const diff = measured - required
  if (diff >= 0) return 'compliant'
  if (diff >= -20) return 'warning'
  return 'non_compliant'
}

function generateReport(logs: PointCloudLog[], radiusTable: SafetyRadius[]): SafetyReport {
  const items: ReportItem[] = logs.map(log => {
    const version = log.status === 'legacy' ? '2023' : '2024'
    const normalizedDir = Math.round(log.windDirection / 90) * 90 % 360
    
    const radiusRecord = radiusTable.find(
      r => r.windDirection === normalizedDir && 
           r.windSpeedMin <= log.windSpeed && 
           r.windSpeedMax > log.windSpeed && 
           r.version === version
    ) || radiusTable.find(
      r => r.windDirection === 0 && 
           r.windSpeedMin <= log.windSpeed && 
           r.windSpeedMax > log.windSpeed && 
           r.version === version
    )
    
    const requiredDistance = radiusRecord?.requiredRadius || 150
    const diff = log.measuredDistance - requiredDistance
    const compliance = calculateCompliance(log.measuredDistance, requiredDistance, log.status)
    
    return {
      logId: log.id,
      batchNo: log.batchNo,
      status: log.status,
      windDirection: log.windDirection,
      windSpeed: log.windSpeed,
      measuredDistance: log.measuredDistance,
      requiredDistance,
      diff,
      compliance,
      hasScreenshotOcclusion: log.hasScreenshotOcclusion,
      occlusionArea: log.occlusionArea,
      version,
      notes: log.notes
    }
  })
  
  const stats = {
    total: logs.length,
    compliant: items.filter(i => i.compliance === 'compliant').length,
    warning: items.filter(i => i.compliance === 'warning').length,
    nonCompliant: items.filter(i => i.compliance === 'non_compliant').length,
    pendingReview: items.filter(i => i.compliance === 'pending').length
  }
  
  return {
    id: `RPT-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    generatedBy: '系统自动生成',
    items,
    stats,
    summary: `共${logs.length}条记录，其中合规${stats.compliant}条，待复核${stats.pendingReview}条，预警${stats.warning}条，不合规${stats.nonCompliant}条`
  }
}

let mockLogs: PointCloudLog[] = [
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
    alerts: []
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
    alerts: []
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
    notes: '2023年历史数据，已从旧口径安全半径表补录',
    alerts: []
  }
]

let mockRadius: SafetyRadius[] = [
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
  const report = generateReport(mockLogs, mockRadius)
  res.status(200).json({
    success: true,
    data: report
  })
})

router.post('/generate', async (req: Request, res: Response): Promise<void> => {
  const { logs, radiusTable } = req.body
  const report = generateReport(
    logs && Array.isArray(logs) ? logs : mockLogs,
    radiusTable && Array.isArray(radiusTable) ? radiusTable : mockRadius
  )
  
  res.status(201).json({
    success: true,
    data: report,
    message: '安全距离报告已生成'
  })
})

router.post('/review', async (req: Request, res: Response): Promise<void> => {
  const { logId, action, reviewedBy, comment } = req.body
  const logIndex = mockLogs.findIndex(l => l.id === logId)
  
  if (logIndex === -1) {
    res.status(404).json({
      success: false,
      error: '日志不存在'
    })
    return
  }
  
  if (action === 'approve') {
    mockLogs[logIndex].status = 'success'
    mockLogs[logIndex].notes += ` | 施工经理${reviewedBy}复核通过`
  } else if (action === 'reject') {
    mockLogs[logIndex].status = 'blocked'
    mockLogs[logIndex].notes += ` | 施工经理${reviewedBy}驳回，原因：${comment || '未说明'}`
  }
  
  const report = generateReport(mockLogs, mockRadius)
  
  res.status(200).json({
    success: true,
    data: {
      log: mockLogs[logIndex],
      report
    },
    message: action === 'approve' ? '已通过复核，报告已更新' : '已驳回，报告已更新'
  })
})

router.get('/export', async (req: Request, res: Response): Promise<void> => {
  const report = generateReport(mockLogs, mockRadius)
  
  const csvContent = [
    ['批次号', '状态', '风向(度)', '风速(m/s)', '实测距离(m)', '要求距离(m)', '差值(m)', '合规性', '口径版本', '备注'].join(','),
    ...report.items.map(item => [
      item.batchNo,
      item.status,
      item.windDirection,
      item.windSpeed,
      item.measuredDistance,
      item.requiredDistance,
      item.diff,
      item.compliance,
      item.version,
      `"${item.notes}"`
    ].join(','))
  ].join('\n')
  
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="safety-report-${Date.now()}.csv"`)
  res.status(200).send('\ufeff' + csvContent)
})

export default router
