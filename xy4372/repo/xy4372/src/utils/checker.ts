import type { 
  Sample, 
  GPSPoint, 
  TransferRecord, 
  LabRules, 
  Issue, 
  IssueType 
} from '@/types'

interface CheckContext {
  samples: Sample[]
  gpsPoints: GPSPoint[]
  transferRecords: TransferRecord[]
  labRules: LabRules
  checkTime: string
}

interface CheckResult {
  issues: Issue[]
  summary: {
    totalSamples: number
    totalIssues: number
    byType: Record<IssueType, number>
    bySeverity: { error: number; warning: number; info: number }
  }
}

function createIssue(
  sampleNumber: string,
  type: IssueType,
  severity: 'error' | 'warning' | 'info',
  title: string,
  description: string,
  data?: Record<string, unknown>
): Issue {
  return {
    id: crypto.randomUUID(),
    sampleNumber,
    type,
    severity,
    title,
    description,
    detectedAt: new Date().toISOString(),
    data,
  }
}

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function parseDateTime(dateStr: string): Date | null {
  if (!dateStr) return null
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return null
  return date
}

function checkMissingTransfers(context: CheckContext): Issue[] {
  const issues: Issue[] = []
  const { samples, transferRecords } = context

  const transferredNumbers = new Set(transferRecords.map(t => t.sampleNumber))

  for (const sample of samples) {
    if (!transferredNumbers.has(sample.sampleNumber)) {
      issues.push(
        createIssue(
          sample.sampleNumber,
          'missing_transfer',
          'error',
          '样品未交接',
          `样品 ${sample.sampleNumber} 存在于二维码清单中，但未找到交接记录`,
          {
            sampleNumber: sample.sampleNumber,
            sampleType: sample.sampleType,
            collector: sample.collector,
          }
        )
      )
    }
  }

  return issues
}

function checkCoordinateDrift(context: CheckContext): Issue[] {
  const issues: Issue[] = []
  const { samples, gpsPoints, labRules } = context

  const maxDrift = labRules.maxDriftMeters || 50
  const gpsMap = new Map(gpsPoints.map(g => [g.sampleNumber, g]))

  for (const sample of samples) {
    const gpsPoint = gpsMap.get(sample.sampleNumber)
    
    if (!gpsPoint) {
      issues.push(
        createIssue(
          sample.sampleNumber,
          'coordinate_drift',
          'warning',
          '缺少GPS数据',
          `样品 ${sample.sampleNumber} 未找到对应的GPS采样点数据`,
          {
            sampleNumber: sample.sampleNumber,
          }
        )
      )
      continue
    }

    const sampleLat = sample.latitude
    const sampleLon = sample.longitude
    const gpsLat = gpsPoint.latitude
    const gpsLon = gpsPoint.longitude

    if (sampleLat === 0 && sampleLon === 0) {
      issues.push(
        createIssue(
          sample.sampleNumber,
          'coordinate_drift',
          'warning',
          '样品坐标缺失',
          `样品 ${sample.sampleNumber} 的坐标信息为空`,
          {
            sampleNumber: sample.sampleNumber,
            gpsLatitude: gpsLat,
            gpsLongitude: gpsLon,
          }
        )
      )
      continue
    }

    if (gpsLat === 0 && gpsLon === 0) {
      issues.push(
        createIssue(
          sample.sampleNumber,
          'coordinate_drift',
          'warning',
          'GPS坐标缺失',
          `样品 ${sample.sampleNumber} 的GPS采样点坐标为空`,
          {
            sampleNumber: sample.sampleNumber,
            sampleLatitude: sampleLat,
            sampleLongitude: sampleLon,
          }
        )
      )
      continue
    }

    const distance = calculateDistance(sampleLat, sampleLon, gpsLat, gpsLon)

    if (distance > maxDrift) {
      issues.push(
        createIssue(
          sample.sampleNumber,
          'coordinate_drift',
          'error',
          '坐标漂移超标',
          `样品 ${sample.sampleNumber} 的坐标与GPS采样点距离 ${distance.toFixed(2)} 米，超过阈值 ${maxDrift} 米`,
          {
            sampleNumber: sample.sampleNumber,
            sampleLatitude: sampleLat,
            sampleLongitude: sampleLon,
            gpsLatitude: gpsLat,
            gpsLongitude: gpsLon,
            distanceMeters: distance,
            maxAllowedMeters: maxDrift,
          }
        )
      )
    }
  }

  return issues
}

function checkDuplicateNumbers(context: CheckContext): Issue[] {
  const issues: Issue[] = []
  const { samples } = context

  const numberCounts = new Map<string, number>()
  const numberSamples = new Map<string, Sample[]>()

  for (const sample of samples) {
    const count = numberCounts.get(sample.sampleNumber) || 0
    numberCounts.set(sample.sampleNumber, count + 1)
    
    const existing = numberSamples.get(sample.sampleNumber) || []
    existing.push(sample)
    numberSamples.set(sample.sampleNumber, existing)
  }

  for (const [sampleNumber, count] of numberCounts.entries()) {
    if (count > 1) {
      const duplicates = numberSamples.get(sampleNumber) || []
      issues.push(
        createIssue(
          sampleNumber,
          'duplicate_number',
          'error',
          '样品编号重复',
          `样品编号 ${sampleNumber} 出现 ${count} 次重复`,
          {
            sampleNumber,
            duplicateCount: count,
            duplicates: duplicates.map((s, i) => ({
              index: i,
              sampleType: s.sampleType,
              longitude: s.longitude,
              latitude: s.latitude,
              collector: s.collector,
              samplingTime: s.samplingTime,
            })),
          }
        )
      )
    }
  }

  return issues
}

function checkTimeoutRefrigeration(context: CheckContext): Issue[] {
  const issues: Issue[] = []
  const { samples, transferRecords, labRules, checkTime } = context

  const checkDate = parseDateTime(checkTime) || new Date()
  const refrigerationLimit = labRules.refrigerationTimeLimitHours || 72
  const frozenLimit = labRules.frozenTimeLimitHours || 168

  const transferMap = new Map(transferRecords.map(t => [t.sampleNumber, t]))

  for (const sample of samples) {
    const storageCondition = sample.storageCondition
    const isRefrigerated = storageCondition === 'refrigerated' || storageCondition === 'frozen'

    if (!isRefrigerated) continue

    const transfer = transferMap.get(sample.sampleNumber)
    const samplingDate = parseDateTime(sample.samplingTime)
    const transferDate = transfer ? parseDateTime(transfer.transferTime) : null

    if (!samplingDate) continue

    const limitHours = storageCondition === 'frozen' ? frozenLimit : refrigerationLimit
    const timeDiffHours = (checkDate.getTime() - samplingDate.getTime()) / (1000 * 60 * 60)

    if (timeDiffHours > limitHours) {
      const transferTimeStr = transferDate 
        ? `交接时间: ${transfer.transferTime}` 
        : '无交接记录'
      
      issues.push(
        createIssue(
          sample.sampleNumber,
          'timeout_not_refrigerated',
          'error',
          '超时未冷藏/冷冻',
          `样品 ${sample.sampleNumber} 需要${storageCondition === 'frozen' ? '冷冻' : '冷藏'}保存，自采样已过去 ${timeDiffHours.toFixed(1)} 小时，超过时限 ${limitHours} 小时。${transferTimeStr}`,
          {
            sampleNumber: sample.sampleNumber,
            storageCondition,
            samplingTime: sample.samplingTime,
            transferTime: transfer?.transferTime || null,
            elapsedHours: timeDiffHours,
            limitHours,
            temperatureAtTransfer: transfer?.temperatureAtTransfer,
          }
        )
      )
    }

    if (transfer && transfer.temperatureAtTransfer !== undefined) {
      const temp = transfer.temperatureAtTransfer
      const expectedMaxTemp = storageCondition === 'frozen' ? -10 : 8
      
      if (temp > expectedMaxTemp) {
        issues.push(
          createIssue(
            sample.sampleNumber,
            'timeout_not_refrigerated',
            'warning',
            '交接温度异常',
            `样品 ${sample.sampleNumber} 交接时温度 ${temp}°C，${storageCondition === 'frozen' ? '冷冻样品应低于-10°C' : '冷藏样品应低于8°C'}`,
            {
              sampleNumber: sample.sampleNumber,
              storageCondition,
              temperatureAtTransfer: temp,
              expectedMaxTemp,
            }
          )
        )
      }
    }
  }

  return issues
}

function checkInvalidTestItems(context: CheckContext): Issue[] {
  const issues: Issue[] = []
  const { samples, labRules } = context

  const allowedTests = new Set(labRules.allowedTestTypes || [])
  const sampleTypeRules = new Map(
    (labRules.sampleTypeRules || []).map(r => [r.sampleType, r])
  )

  for (const sample of samples) {
    const requiredTests = sample.requiredTests || []
    
    if (requiredTests.length === 0) {
      issues.push(
        createIssue(
          sample.sampleNumber,
          'invalid_test_items',
          'warning',
          '未指定检测项目',
          `样品 ${sample.sampleNumber} 未指定检测项目`,
          {
            sampleNumber: sample.sampleNumber,
            sampleType: sample.sampleType,
          }
        )
      )
      continue
    }

    const invalidTests: string[] = []
    for (const test of requiredTests) {
      if (allowedTests.size > 0 && !allowedTests.has(test)) {
        invalidTests.push(test)
      }
    }

    if (invalidTests.length > 0) {
      issues.push(
        createIssue(
          sample.sampleNumber,
          'invalid_test_items',
          'error',
          '检测项目不合法',
          `样品 ${sample.sampleNumber} 的检测项目包含不支持的类型: ${invalidTests.join(', ')}`,
          {
            sampleNumber: sample.sampleNumber,
            sampleType: sample.sampleType,
            requestedTests: requiredTests,
            invalidTests,
            allowedTests: Array.from(allowedTests),
          }
        )
      )
    }

    const typeRule = sampleTypeRules.get(sample.sampleType)
    if (typeRule && typeRule.requiredTests.length > 0) {
      const missingTests: string[] = []
      for (const required of typeRule.requiredTests) {
        if (!requiredTests.includes(required)) {
          missingTests.push(required)
        }
      }

      if (missingTests.length > 0) {
        issues.push(
          createIssue(
            sample.sampleNumber,
            'invalid_test_items',
            'warning',
            '缺少必需检测项目',
            `样品 ${sample.sampleNumber}（${sample.sampleType}）缺少必需检测项目: ${missingTests.join(', ')}`,
            {
              sampleNumber: sample.sampleNumber,
              sampleType: sample.sampleType,
              requestedTests: requiredTests,
              missingRequiredTests: missingTests,
            }
          )
        )
      }
    }
  }

  return issues
}

export function runAllChecks(
  samples: Sample[],
  gpsPoints: GPSPoint[],
  transferRecords: TransferRecord[],
  labRules: LabRules,
  checkTime?: string
): CheckResult {
  const context: CheckContext = {
    samples,
    gpsPoints,
    transferRecords,
    labRules,
    checkTime: checkTime || new Date().toISOString(),
  }

  const allIssues: Issue[] = [
    ...checkMissingTransfers(context),
    ...checkCoordinateDrift(context),
    ...checkDuplicateNumbers(context),
    ...checkTimeoutRefrigeration(context),
    ...checkInvalidTestItems(context),
  ]

  const byType: Record<IssueType, number> = {
    missing_transfer: 0,
    coordinate_drift: 0,
    duplicate_number: 0,
    timeout_not_refrigerated: 0,
    invalid_test_items: 0,
  }

  const bySeverity = { error: 0, warning: 0, info: 0 }

  for (const issue of allIssues) {
    byType[issue.type]++
    bySeverity[issue.severity]++
  }

  return {
    issues: allIssues,
    summary: {
      totalSamples: samples.length,
      totalIssues: allIssues.length,
      byType,
      bySeverity,
    },
  }
}

export const ISSUE_TYPE_NAMES: Record<IssueType, string> = {
  missing_transfer: '漏交样品',
  coordinate_drift: '坐标漂移',
  duplicate_number: '编号重复',
  timeout_not_refrigerated: '超时未冷藏',
  invalid_test_items: '检测项目不符',
}

export const ISSUE_TYPE_COLORS: Record<IssueType, string> = {
  missing_transfer: '#f56c6c',
  coordinate_drift: '#e6a23c',
  duplicate_number: '#f56c6c',
  timeout_not_refrigerated: '#f56c6c',
  invalid_test_items: '#409eff',
}
