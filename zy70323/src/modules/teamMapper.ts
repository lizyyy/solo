import { ApiLog, AppMapping, ValidationIssue } from '../types'

export class TeamMapper {
  private mappings: AppMapping[] = []

  loadMappings(mappings: AppMapping[]): void {
    this.mappings = mappings
  }

  findMappingForLog(log: ApiLog): AppMapping | null {
    const logTime = new Date(log.timestamp).getTime()
    
    const candidateMappings = this.mappings.filter(m => {
      if (m.appId !== log.appId) return false
      
      const effectiveFrom = new Date(m.effectiveFrom).getTime()
      if (logTime < effectiveFrom) return false
      
      if (m.effectiveTo) {
        const effectiveTo = new Date(m.effectiveTo).getTime()
        if (logTime > effectiveTo) return false
      }
      
      return true
    })

    return candidateMappings.length > 0 ? candidateMappings[0] : null
  }

  findMappingGaps(logs: ApiLog[]): Array<{ appId: string; callCount: number; lastSeen: string }> {
    const gapMap = new Map<string, { count: number; lastSeen: string }>()

    for (const log of logs) {
      const mapping = this.findMappingForLog(log)
      if (!mapping) {
        const existing = gapMap.get(log.appId)
        if (existing) {
          existing.count += 1
          if (log.timestamp > existing.lastSeen) {
            existing.lastSeen = log.timestamp
          }
        } else {
          gapMap.set(log.appId, { count: 1, lastSeen: log.timestamp })
        }
      }
    }

    return Array.from(gapMap.entries()).map(([appId, info]) => ({
      appId,
      callCount: info.count,
      lastSeen: info.lastSeen
    }))
  }

  validateMappings(logs: ApiLog[]): ValidationIssue[] {
    const issues: ValidationIssue[] = []
    const gaps = this.findMappingGaps(logs)

    if (gaps.length > 0) {
      const totalGapCalls = gaps.reduce((sum, g) => sum + g.callCount, 0)
      issues.push({
        type: 'unknown_app_id',
        severity: 'warning',
        message: `发现 ${gaps.length} 个未知 appId，影响 ${totalGapCalls} 条调用`,
        affectedCount: totalGapCalls,
        details: {
          unknownAppIds: gaps.map(g => ({
            appId: g.appId,
            callCount: g.callCount
          }))
        }
      })
    }

    const now = new Date().getTime()
    const expiredMappings = this.mappings.filter(m => {
      if (!m.effectiveTo) return false
      const effectiveTo = new Date(m.effectiveTo).getTime()
      return now > effectiveTo
    })

    if (expiredMappings.length > 0) {
      issues.push({
        type: 'mapping_expired',
        severity: 'info',
        message: `发现 ${expiredMappings.length} 个已过期的 appId 映射`,
        affectedCount: expiredMappings.length,
        details: {
          expiredAppIds: expiredMappings.map(m => m.appId)
        }
      })
    }

    return issues
  }

  getTeamInfo(teamId: string): AppMapping | null {
    return this.mappings.find(m => m.teamId === teamId) || null
  }

  getAllTeams(): string[] {
    return Array.from(new Set(this.mappings.map(m => m.teamId)))
  }

  getAllBusinessLines(): string[] {
    return Array.from(new Set(this.mappings.map(m => m.businessLine)))
  }
}
