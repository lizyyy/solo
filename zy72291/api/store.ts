import type { PointCloudLog, SafetyRadius, SafetyReport, ReportResult, ReportItem, ComplianceStatus, RecordType, RadiusVersion, WindSpeed, RadiusVersionReport, ReportStatus } from '../shared/types.js'

function createInitialLogs(): PointCloudLog[] {
  return [
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
        {
          id: 'A-001',
          type: 'distance',
          level: 'info',
          message: '北侧障碍物距离正常，实测185米，要求150米',
          isOccluded: false,
          position: { x: 120, y: 80, z: 45 }
        }
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
        {
          id: 'A-002',
          type: 'distance',
          level: 'danger',
          message: '东北方向安全距离不足，实测88米，要求200米',
          isOccluded: true,
          position: { x: 95, y: -110, z: 38 }
        },
        {
          id: 'A-003',
          type: 'obstacle',
          level: 'warning',
          message: '高压塔位置标记存疑，坐标偏差约12米',
          isOccluded: false,
          position: { x: 80, y: -90, z: 52 }
        }
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
        {
          id: 'A-004',
          type: 'height',
          level: 'warning',
          message: '相对高度按2023旧口径计算，安全裕度降低20%',
          isOccluded: false,
          position: { x: -60, y: 130, z: 41 }
        }
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
}

function createInitialRadiusTable(): SafetyRadius[] {
  return [
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
    { id: 'R-016', windDirection: 315, windSpeed: 'medium', radius: 170, version: 'legacy', effectiveDate: '2023-01-01', source: 'GB 2023-滑翔伞场地规范' }
  ]
}

export interface AppState {
  logs: PointCloudLog[]
  radiusTable: SafetyRadius[]
}

export const state: AppState = {
  logs: createInitialLogs(),
  radiusTable: createInitialRadiusTable()
}

export function resetState(): void {
  state.logs = createInitialLogs()
  state.radiusTable = createInitialRadiusTable()
}

function speedToWindSpeedLevel(speed: number): WindSpeed {
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

export function buildSafetyReport(
  logs: PointCloudLog[],
  radiusTable: SafetyRadius[]
): SafetyReport {
  const results: ReportResult[] = logs.map((log: PointCloudLog): ReportResult => {
    const version: RadiusVersion = log.status === 'legacy' ? 'legacy' : 'new'
    const windDir: number =
      log.windDirection ?? (log.alerts[0]?.position.x ?? 0) > 0 ? 45 : 180
    const windSpeedNum: number = log.windSpeed ?? 4.5
    const windSpeedLevel: WindSpeed = speedToWindSpeedLevel(windSpeedNum)
    const normalizedDir: number = (Math.round(windDir / 45) * 45) % 360

    const radiusRecord: SafetyRadius | undefined =
      radiusTable.find(
        (r: SafetyRadius): boolean =>
          r.windDirection === normalizedDir &&
          r.windSpeed === windSpeedLevel &&
          r.version === version
      ) ??
      radiusTable.find(
        (r: SafetyRadius): boolean =>
          r.windDirection === 0 &&
          r.windSpeed === windSpeedLevel &&
          r.version === version
      )

    const requiredDistance: number = radiusRecord?.radius ?? 200
    const safetyDistance: number =
      log.measuredDistance ??
      (log.status === 'success'
        ? 185
        : log.status === 'pending_review'
          ? 88
          : 195)
    const recordType: RecordType =
      log.status === 'success'
        ? 'success'
        : log.status === 'legacy'
          ? 'legacy'
          : 'blocked'

    const note: string =
      log.notes ??
      (log.status === 'success'
        ? '数据完整，合规'
        : log.status === 'pending_review'
          ? '截图遮挡，读数存疑，待复核'
          : '旧口径补录，已标注新旧标准差异')

    return {
      id: `RES-${log.id}`,
      recordId: log.id,
      recordType,
      safetyDistance,
      requiredDistance,
      compliance: safetyDistance >= requiredDistance,
      note,
      windDirection: normalizedDir,
      windSpeed: windSpeedLevel
    }
  })

  const items: ReportItem[] = logs.map((log: PointCloudLog): ReportItem => {
    const version: RadiusVersion = log.status === 'legacy' ? 'legacy' : 'new'
    const windDir: number = log.windDirection ?? 180
    const windSpeedNum: number = log.windSpeed ?? 4.5
    const windSpeedLevel: WindSpeed = speedToWindSpeedLevel(windSpeedNum)
    const normalizedDir: number = (Math.round(windDir / 45) * 45) % 360

    const radiusRecord: SafetyRadius | undefined =
      radiusTable.find(
        (r: SafetyRadius): boolean =>
          r.windDirection === normalizedDir &&
          r.windSpeed === windSpeedLevel &&
          r.version === version
      ) ??
      radiusTable.find(
        (r: SafetyRadius): boolean =>
          r.windDirection === 0 &&
          r.windSpeed === windSpeedLevel &&
          r.version === version
      )

    const requiredDistance: number = radiusRecord?.radius ?? 200
    const measuredDistance: number = log.measuredDistance ?? 150
    const diff: number = measuredDistance - requiredDistance

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
      notes: log.notes ?? ''
    }
  })

  const stats: {
    total: number
    compliant: number
    warning: number
    nonCompliant: number
    pendingReview: number
  } = {
    total: logs.length,
    compliant: items.filter((i: ReportItem): boolean => i.compliance === 'compliant').length,
    warning: items.filter((i: ReportItem): boolean => i.compliance === 'warning').length,
    nonCompliant: items.filter((i: ReportItem): boolean => i.compliance === 'non_compliant').length,
    pendingReview: items.filter((i: ReportItem): boolean => i.compliance === 'pending').length
  }

  const hasLegacy: boolean = radiusTable.some((r: SafetyRadius): boolean => r.version === 'legacy')
  const hasNew: boolean = radiusTable.some((r: SafetyRadius): boolean => r.version === 'new')
  const radiusVersion: RadiusVersionReport =
    hasLegacy && hasNew ? 'mixed' : (radiusTable[0]?.version ?? 'new')

  const status: ReportStatus = logs.some(
    (l: PointCloudLog): boolean => l.status === 'pending_review'
  )
    ? 'pending_review'
    : 'draft'

  const notes: string = logs.some((l: PointCloudLog): boolean => l.status === 'pending_review')
    ? '报告包含待复核记录，需施工经理确认后才能最终批准'
    : '所有记录已处理完成'

  const summary: string = `共${logs.length}条记录，其中合规${stats.compliant}条，待复核${stats.pendingReview}条，预警${stats.warning}条，不合规${stats.nonCompliant}条`

  return {
    id: `RPT-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    generatedBy: '系统自动生成',
    logIds: logs.map((l: PointCloudLog): string => l.id),
    radiusVersion,
    results,
    items,
    stats,
    status,
    notes,
    summary
  }
}
