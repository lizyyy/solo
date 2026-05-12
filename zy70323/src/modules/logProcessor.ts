import { ApiLog, ValidationIssue } from '../types'

export class LogProcessor {
  private logs: ApiLog[] = []

  loadLogs(logs: ApiLog[]): void {
    this.logs = logs
  }

  deduplicate(): { deduplicated: ApiLog[]; duplicates: ApiLog[]; issues: ValidationIssue[] } {
    const seen = new Map<string, ApiLog>()
    const duplicates: ApiLog[] = []
    const issues: ValidationIssue[] = []

    for (const log of this.logs) {
      const key = log.requestId
      if (seen.has(key)) {
        duplicates.push(log)
      } else {
        seen.set(key, log)
      }
    }

    if (duplicates.length > 0) {
      issues.push({
        type: 'duplicate_log',
        severity: 'warning',
        message: `发现 ${duplicates.length} 条重复日志（按 requestId 去重）`,
        affectedCount: duplicates.length,
        details: {
          sampleRequestIds: duplicates.slice(0, 5).map(d => d.requestId)
        }
      })
    }

    return {
      deduplicated: Array.from(seen.values()),
      duplicates,
      issues
    }
  }

  filterByPeriod(periodStart: string, periodEnd: string, logs: ApiLog[]): ApiLog[] {
    const start = new Date(periodStart).getTime()
    const end = new Date(periodEnd).getTime()

    return logs.filter(log => {
      const logTime = new Date(log.timestamp).getTime()
      return logTime >= start && logTime <= end
    })
  }

  getUniqueAppIds(logs: ApiLog[]): string[] {
    return Array.from(new Set(logs.map(l => l.appId)))
  }

  getUniqueApiNames(logs: ApiLog[]): string[] {
    return Array.from(new Set(logs.map(l => l.apiName)))
  }

  getAppIdCallCounts(logs: ApiLog[]): Map<string, number> {
    const counts = new Map<string, number>()
    for (const log of logs) {
      counts.set(log.appId, (counts.get(log.appId) || 0) + 1)
    }
    return counts
  }

  getApiCallCounts(logs: ApiLog[]): Map<string, number> {
    const counts = new Map<string, number>()
    for (const log of logs) {
      counts.set(log.apiName, (counts.get(log.apiName) || 0) + 1)
    }
    return counts
  }
}
