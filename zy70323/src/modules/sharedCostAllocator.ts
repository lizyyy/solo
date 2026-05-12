import { SharedCostConfig, SharedPool, SharedPoolBreakdown, ValidationIssue } from '../types'

export class SharedCostAllocator {
  private config: SharedCostConfig | null = null

  loadConfig(config: SharedCostConfig): void {
    this.config = config
  }

  validateRatioIssues(): Array<{
    poolId: string
    poolName: string
    totalRatio: number
    teams: string[]
  }> {
    if (!this.config) return []

    const issues: Array<{
      poolId: string
      poolName: string
      totalRatio: number
      teams: string[]
    }> = []

    const now = new Date().getTime()

    for (const pool of this.config.pools) {
      const activeAllocations = pool.allocations.filter(a => {
        const effectiveFrom = new Date(a.effectiveFrom).getTime()
        if (now < effectiveFrom) return false
        if (a.effectiveTo) {
          const effectiveTo = new Date(a.effectiveTo).getTime()
          if (now > effectiveTo) return false
        }
        return true
      })

      const totalRatio = activeAllocations.reduce((sum, a) => sum + a.ratio, 0)

      if (Math.abs(totalRatio - 1) > 0.001) {
        issues.push({
          poolId: pool.poolId,
          poolName: pool.poolName,
          totalRatio,
          teams: activeAllocations.map(a => a.teamId)
        })
      }
    }

    return issues
  }

  validateConfig(): ValidationIssue[] {
    const issues: ValidationIssue[] = []

    if (!this.config) {
      issues.push({
        type: 'ratio_over_100',
        severity: 'error',
        message: '未加载共享成本配置'
      })
      return issues
    }

    const ratioIssues = this.validateRatioIssues()

    for (const issue of ratioIssues) {
      const percentage = Math.round(issue.totalRatio * 100 * 100) / 100
      issues.push({
        type: 'ratio_over_100',
        severity: issue.totalRatio > 1 ? 'error' : 'warning',
        message: `共享池 "${issue.poolName}" 的分配比例合计为 ${percentage}%，不等于 100%`,
        details: {
          poolId: issue.poolId,
          totalRatio: issue.totalRatio,
          teams: issue.teams
        }
      })
    }

    return issues
  }

  allocatePoolCost(
    pool: SharedPool,
    totalCost: number,
    teamCallVolumes?: Map<string, number>
  ): SharedPoolBreakdown {
    const now = new Date().getTime()

    const activeAllocations = pool.allocations.filter(a => {
      const effectiveFrom = new Date(a.effectiveFrom).getTime()
      if (now < effectiveFrom) return false
      if (a.effectiveTo) {
        const effectiveTo = new Date(a.effectiveTo).getTime()
        if (now > effectiveTo) return false
      }
      return true
    })

    const allocations: Array<{
      teamId: string
      teamName: string
      ratio: number
      amount: number
    }> = []

    let explanation = ''

    if (pool.allocationStrategy === 'byRatio') {
      const totalRatio = activeAllocations.reduce((sum, a) => sum + a.ratio, 0)
      
      for (const alloc of activeAllocations) {
        const ratio = totalRatio > 0 ? alloc.ratio / totalRatio : 0
        const amount = Math.round(totalCost * ratio * 10000) / 10000
        allocations.push({
          teamId: alloc.teamId,
          teamName: this.getTeamName(alloc.teamId),
          ratio: alloc.ratio,
          amount
        })
      }
      explanation = `按固定比例分配：${activeAllocations.map(a => `${a.teamId}=${Math.round(a.ratio * 100)}%`).join(', ')}`
    } else if (pool.allocationStrategy === 'byCallVolume' && teamCallVolumes) {
      const teamIds = activeAllocations.map(a => a.teamId)
      const totalVolume = teamIds.reduce((sum, tid) => sum + (teamCallVolumes.get(tid) || 0), 0)

      if (totalVolume > 0) {
        for (const alloc of activeAllocations) {
          const volume = teamCallVolumes.get(alloc.teamId) || 0
          const ratio = volume / totalVolume
          const amount = Math.round(totalCost * ratio * 10000) / 10000
          allocations.push({
            teamId: alloc.teamId,
            teamName: this.getTeamName(alloc.teamId),
            ratio,
            amount
          })
        }
        explanation = `按调用量比例分配：总调用量 ${totalVolume}，各团队调用量：${teamIds.map(tid => `${tid}=${teamCallVolumes.get(tid) || 0}`).join(', ')}`
      } else {
        const equalRatio = teamIds.length > 0 ? 1 / teamIds.length : 0
        for (const alloc of activeAllocations) {
          const amount = Math.round(totalCost * equalRatio * 10000) / 10000
          allocations.push({
            teamId: alloc.teamId,
            teamName: this.getTeamName(alloc.teamId),
            ratio: equalRatio,
            amount
          })
        }
        explanation = '无调用量数据，平均分配'
      }
    } else {
      explanation = '未配置有效的分配策略'
    }

    return {
      poolId: pool.poolId,
      poolName: pool.poolName,
      totalCost,
      allocations,
      explanation
    }
  }

  getPoolById(poolId: string): SharedPool | null {
    return this.config?.pools.find(p => p.poolId === poolId) || null
  }

  getPools(): SharedPool[] {
    return this.config?.pools || []
  }

  getUnknownAppIdPolicy() {
    return this.config?.unknownAppIdPolicy
  }

  private getTeamName(teamId: string): string {
    return teamId
  }
}
