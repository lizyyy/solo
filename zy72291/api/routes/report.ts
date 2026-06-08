import { Router, type Request, type Response } from 'express'
import type { SafetyReport, PointCloudLog, SafetyRadius, ReportResult, ReportItem, ComplianceStatus, RecordType, RadiusVersion } from '../../shared/types.js'

const router = Router()

function speedToWindSpeedLevel(speed: number): 'low' | 'medium' | 'high' {
  if (speed < 6) return 'low'
  if (speed < 12) return 'medium'
  return 'high'
}

function calculateCompliance(measured: number, required: number, status: string): ComplianceStatus {
  if (status === 'pending_review') return 'pending'
  const diff = measured - required
  if (diff >= 0) return 'compliant'
  if (diff >= -20) return 'warning'
  return 'non_compliant'
}

function generateReport(logs: PointCloudLog[], radiusTable: SafetyRadius[]): SafetyReport {
  const results: ReportResult[] = logs.map(log => {
    const version: RadiusVersion = log.status === 'legacy' ? 'legacy' : 'new'
    const windDir = log.windDirection ?? log.alerts[0]?.position.x > 0 ? 45 : 180
    const windSpeedNum = log.windSpeed ?? 4.5
    const windSpeedLevel = speedToWindSpeedLevel(windSpeedNum)
    const normalizedDir = Math.round(windDir / 45) * 45 % 360

    const radiusRecord = radiusTable.find(
      r => r.windDirection === normalizedDir &&
           r.windSpeed === windSpeedLevel &&
           r.version === version
    ) || radiusTable.find(
      r => r.windDirection === 0 &&
           r.windSpeed === windSpeedLevel &&
           r.version === version
    )

    const requiredDistance = radiusRecord?.radius || 200
    const safetyDistance = log.measuredDistance ?? (log.status === 'success' ? 185 : log.status === 'pending_review' ? 88 : 195)
    const recordType: RecordType = log.status === 'success' ? 'success' : log.status === 'legacy' ? 'legacy' : 'blocked'

    return {
      id: `RES-${log.id}`,
      recordId: log.id,
      recordType,
      safetyDistance,
      requiredDistance,
      compliance: safetyDistance >= requiredDistance,
      note: log.notes || (log.status === 'success' ? '数据完整，合规' : log.status === 'pending_review' ? '截图遮挡，读数存疑，待复核' : '旧口径补录，已标注新旧标准差异'),
      windDirection: normalizedDir,
      windSpeed: windSpeedLevel
    }
  })

  const items: ReportItem[] = logs.map(log => {
    const version = log.status === 'legacy' ? 'legacy' : 'new'
    const windDir = log.windDirection ?? 180
    const windSpeedNum = log.windSpeed ?? 4.5
    const windSpeedLevel = speedToWindSpeedLevel(windSpeedNum)
    const normalizedDir = Math.round(windDir / 45) * 45 % 360

    const radiusRecord = radiusTable.find(
      r => r.windDirection === normalizedDir &&
           r.windSpeed === windSpeedLevel &&
           r.version === version
    ) || radiusTable.find(
      r => r.windDirection === 0 &&
           r.windSpeed === windSpeedLevel &&
           r.version === version
    )

    const requiredDistance = radiusRecord?.radius || 200
    const measuredDistance = log.measuredDistance ?? 150
    const diff = measuredDistance - requiredDistance

    return {
      logId: log.id,
      batchNo: log.batchNo,
      status: log.status,
      windDirection: normalizedDir,
      windSpeed: windSpeedNum,
      measuredDistance,
      requiredDistance,
      diff,
      compliance: calculateCompliance(measuredDistance, requiredDistance, log.status),
      hasScreenshotOcclusion: log.hasScreenshotOcclusion,
      occlusionArea: log.occlusionArea ?? 0,
      version: version === 'new' ? '2024' : '2023',
      notes: log.notes || ''
    }
  })

  const stats = {
    total: logs.length,
    compliant: items.filter(i => i.compliance === 'compliant').length,
    warning: items.filter(i => i.compliance === 'warning').length,
    nonCompliant: items.filter(i => i.compliance === 'non_compliant').length,
    pendingReview: items.filter(i => i.compliance === 'pending').length
  }

  const radiusVersion = radiusTable.some(r => r.version === 'legacy') && radiusTable.some(r => r.version === 'new')
    ? 'mixed' as const
    : radiusTable[0]?.version || 'new' as const

  return {
    id: `RPT-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    generatedBy: '系统自动生成',
    logIds: logs.map(l => l.id),
    radiusVersion,
    results,
    items,
    stats,
    status: logs.some(l => l.status === 'pending_review') ? 'pending_review' : 'draft',
    notes: logs.some(l => l.status === 'pending_review')
      ? '报告包含待复核记录，需施工经理确认后才能最终批准'
      : '所有记录已处理完成',
    summary: `共${logs.length}条记录，其中合规${stats.compliant}条，待复核${stats.pendingReview}条，预警${stats.warning}条，不合规${stats.nonCompliant}条`
  }
}

const mockLogs: PointCloudLog[] = [
  {
    id: 'LOG-001', batchNo: 'PC-2024-0615-A', timestamp: '2024-06-15T08:30:00',
    pointCount: 1250000, thinningRate: 0.85, status: 'success', source: '机载LiDAR',
    hasScreenshotOcclusion: false, rerunCount: 0,
    windDirection: 180, windSpeed: 4.5, measuredDistance: 185,
    operator: '许工', notes: '机载LiDAR扫描，数据质量良好，无遮挡',
    alerts: [{ id: 'A-001', type: 'distance', level: 'info', message: '北侧障碍物距离正常', isOccluded: false, position: { x: 120, y: 80, z: 45 } }]
  },
  {
    id: 'LOG-002', batchNo: 'PC-2024-0615-B', timestamp: '2024-06-15T14:20:00',
    pointCount: 980000, thinningRate: 0.82, status: 'pending_review', source: '移动端巡检',
    hasScreenshotOcclusion: true, rerunCount: 0,
    windDirection: 270, windSpeed: 6.2, measuredDistance: 88,
    occlusionArea: 40, operator: '许工',
    screenshotNote: '告警标签区域被移动端截图水印遮挡约40%',
    notes: '移动端巡检，告警标签被截图遮挡约40%，待施工经理复核',
    alerts: [
      { id: 'A-002', type: 'distance', level: 'danger', message: '东北方向安全距离不足', isOccluded: true, position: { x: 95, y: -110, z: 38 } },
      { id: 'A-003', type: 'obstacle', level: 'warning', message: '高压塔位置标记存疑', isOccluded: false, position: { x: 80, y: -90, z: 52 } }
    ]
  },
  {
    id: 'LOG-003', batchNo: 'PC-2024-0614-A', timestamp: '2024-06-14T16:45:00',
    pointCount: 1120000, thinningRate: 0.88, status: 'legacy', source: '历史数据补录',
    hasScreenshotOcclusion: false, rerunCount: 1,
    manualCorrection: '从2023版安全半径表补录旧口径数据',
    windDirection: 90, windSpeed: 3.8, measuredDistance: 195,
    operator: '许工', notes: '2023年历史数据，已从旧口径安全半径表补录',
    alerts: [{ id: 'A-004', type: 'height', level: 'warning', message: '相对高度按2023旧口径计算', isOccluded: false, position: { x: -60, y: 130, z: 41 } }]
  }
]

const mockRadius: SafetyRadius[] = [
  { id: 'R-001', windDirection: 0, windSpeed: 'low', radius: 150, version: 'new', effectiveDate: '2024-01-01', source: 'GB 2024' },
  { id: 'R-002', windDirection: 0, windSpeed: 'low', radius: 120, version: 'legacy', effectiveDate: '2023-01-01', source: 'GB 2023' },
  { id: 'R-003', windDirection: 45, windSpeed: 'medium', radius: 200, version: 'new', effectiveDate: '2024-01-01', source: 'GB 2024' },
  { id: 'R-004', windDirection: 45, windSpeed: 'medium', radius: 160, version: 'legacy', effectiveDate: '2023-01-01', source: 'GB 2023' },
  { id: 'R-005', windDirection: 90, windSpeed: 'high', radius: 280, version: 'new', effectiveDate: '2024-01-01', source: 'GB 2024' },
  { id: 'R-006', windDirection: 90, windSpeed: 'high', radius: 220, version: 'legacy', effectiveDate: '2023-01-01', source: 'GB 2023' },
  { id: 'R-009', windDirection: 180, windSpeed: 'low', radius: 180, version: 'new', effectiveDate: '2024-01-01', source: 'GB 2024' },
  { id: 'R-010', windDirection: 180, windSpeed: 'low', radius: 140, version: 'legacy', effectiveDate: '2023-01-01', source: 'GB 2023' },
  { id: 'R-013', windDirection: 270, windSpeed: 'high', radius: 300, version: 'new', effectiveDate: '2024-01-01', source: 'GB 2024' },
  { id: 'R-014', windDirection: 270, windSpeed: 'high', radius: 240, version: 'legacy', effectiveDate: '2023-01-01', source: 'GB 2023' },
]

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const report = generateReport(mockLogs, mockRadius)
  res.status(200).json({ success: true, data: report })
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
    res.status(404).json({ success: false, error: '日志不存在' })
    return
  }

  if (action === 'approve') {
    mockLogs[logIndex] = { ...mockLogs[logIndex], status: 'success' }
    mockLogs[logIndex].notes = `${mockLogs[logIndex].notes || ''} | 施工经理${reviewedBy}复核通过`
  } else if (action === 'reject') {
    mockLogs[logIndex] = { ...mockLogs[logIndex], status: 'blocked' }
    mockLogs[logIndex].notes = `${mockLogs[logIndex].notes || ''} | 施工经理${reviewedBy}驳回，原因：${comment || '未说明'}`
  }

  const report = generateReport(mockLogs, mockRadius)

  res.status(200).json({
    success: true,
    data: { log: mockLogs[logIndex], report },
    message: action === 'approve' ? '已通过复核，报告已更新' : '已驳回，报告已更新'
  })
})

router.get('/export', async (req: Request, res: Response): Promise<void> => {
  const report = generateReport(mockLogs, mockRadius)

  const csvContent = [
    ['批次号', '状态', '风向(度)', '风速', '实测距离(m)', '要求距离(m)', '差值(m)', '合规性', '口径版本', '备注'].join(','),
    ...(report.items || []).map(item => [
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
