import { ManualAdjustment, ValidationIssue } from '../types'

export interface CreateAdjustmentParams {
  createdBy: string
  effectiveFrom: string
  effectiveTo?: string
  requestId?: string
  appId?: string
  apiName?: string
  targetTeamId: string
  targetTeamName: string
  targetBusinessLine: string
  amount: number
  reason: string
}

export class ManualAdjustmentManager {
  private adjustments: ManualAdjustment[] = []

  loadAdjustments(adjustments: ManualAdjustment[]): void {
    this.adjustments = adjustments.map(adj => ({
      ...adj,
      isExpired: this.checkIsExpired(adj)
    }))
  }

  createAdjustment(params: CreateAdjustmentParams): ManualAdjustment {
    const id = `adj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const now = new Date().toISOString()

    const adjustment: ManualAdjustment = {
      id,
      createdAt: now,
      createdBy: params.createdBy,
      effectiveFrom: params.effectiveFrom,
      effectiveTo: params.effectiveTo || null,
      requestId: params.requestId,
      appId: params.appId,
      apiName: params.apiName,
      targetTeamId: params.targetTeamId,
      targetTeamName: params.targetTeamName,
      targetBusinessLine: params.targetBusinessLine,
      amount: params.amount,
      reason: params.reason,
      isExpired: false
    }

    adjustment.isExpired = this.checkIsExpired(adjustment)
    this.adjustments.push(adjustment)

    return adjustment
  }

  getAdjustments(): ManualAdjustment[] {
    return this.adjustments.map(adj => ({
      ...adj,
      isExpired: this.checkIsExpired(adj)
    }))
  }

  getActiveAdjustments(periodStart: string, periodEnd: string): ManualAdjustment[] {
    const start = new Date(periodStart).getTime()
    const end = new Date(periodEnd).getTime()

    return this.adjustments.filter(adj => {
      if (this.checkIsExpired(adj)) return false

      const effectiveFrom = new Date(adj.effectiveFrom).getTime()
      if (effectiveFrom > end) return false

      if (adj.effectiveTo) {
        const effectiveTo = new Date(adj.effectiveTo).getTime()
        if (effectiveTo < start) return false
      }

      return true
    })
  }

  getAdjustmentsForLog(requestId: string, appId: string, apiName: string): ManualAdjustment[] {
    return this.getActiveAdjustments(
      new Date(0).toISOString(),
      new Date().toISOString()
    ).filter(adj => {
      if (adj.requestId && adj.requestId !== requestId) return false
      if (adj.appId && adj.appId !== appId) return false
      if (adj.apiName && adj.apiName !== apiName) return false
      return true
    })
  }

  getExpiredAdjustments(): ManualAdjustment[] {
    return this.adjustments.filter(adj => this.checkIsExpired(adj))
  }

  validateAdjustments(): ValidationIssue[] {
    const issues: ValidationIssue[] = []
    const expired = this.getExpiredAdjustments()

    if (expired.length > 0) {
      issues.push({
        type: 'manual_adj_expired',
        severity: 'warning',
        message: `发现 ${expired.length} 条已过期的人工归属记录`,
        affectedCount: expired.length,
        details: {
          expiredAdjustments: expired.map(e => ({
            id: e.id,
            reason: e.reason,
            effectiveTo: e.effectiveTo
          }))
        }
      })
    }

    return issues
  }

  private checkIsExpired(adjustment: ManualAdjustment): boolean {
    if (!adjustment.effectiveTo) return false
    const now = new Date().getTime()
    const effectiveTo = new Date(adjustment.effectiveTo).getTime()
    return now > effectiveTo
  }
}
