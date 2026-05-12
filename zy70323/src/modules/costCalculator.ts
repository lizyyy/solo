import {
  ApiLog,
  AppMapping,
  CalculationContext,
  CalculationResult,
  ChargeDetail,
  CostRule,
  PreflightResult,
  RecomputeDiff,
  UnsettledItem,
  ApiCostSummary,
  TeamBill,
  BusinessLineSummary
} from '../types'
import { LogProcessor } from './logProcessor'
import { CostRuleEngine } from './costRuleEngine'
import { TeamMapper } from './teamMapper'
import { SharedCostAllocator } from './sharedCostAllocator'
import { ManualAdjustmentManager } from './manualAdjustmentManager'

export class CostCalculator {
  private logProcessor = new LogProcessor()
  private costRuleEngine = new CostRuleEngine()
  private teamMapper = new TeamMapper()
  private sharedAllocator = new SharedCostAllocator()
  private manualAdjManager = new ManualAdjustmentManager()

  loadContext(ctx: CalculationContext): void {
    this.logProcessor.loadLogs(ctx.logs)
    this.costRuleEngine.loadRules(ctx.costRules)
    this.teamMapper.loadMappings(ctx.appMappings)
    this.sharedAllocator.loadConfig(ctx.sharedConfig)
    this.manualAdjManager.loadAdjustments(ctx.manualAdjustments || [])
  }

  preflightCheck(ctx: CalculationContext): PreflightResult {
    this.loadContext(ctx)
    const issues: PreflightResult['issues'] = []

    const { deduplicated, issues: logIssues } = this.logProcessor.deduplicate()
    issues.push(...logIssues)

    const ruleIssues = this.costRuleEngine.validateRulesAgainstLogs(deduplicated)
    issues.push(...ruleIssues)

    const mappingIssues = this.teamMapper.validateMappings(deduplicated)
    issues.push(...mappingIssues)

    const configIssues = this.sharedAllocator.validateConfig()
    issues.push(...configIssues)

    const adjIssues = this.manualAdjManager.validateAdjustments()
    issues.push(...adjIssues)

    const mappingGaps = this.teamMapper.findMappingGaps(deduplicated)

    const unknownApis: PreflightResult['unknownApis'] = []
    const apiCounts = this.logProcessor.getApiCallCounts(deduplicated)
    for (const [apiName, count] of apiCounts.entries()) {
      const hasRule = this.costRuleEngine.findRuleForLog({
        timestamp: ctx.periodStart,
        requestId: 'dummy',
        appId: 'dummy',
        apiName,
        duration: 0,
        status: 200,
        responseSize: 0
      } as ApiLog)
      if (!hasRule) {
        unknownApis.push({ apiName, callCount: count })
      }
    }

    const ratioIssues = this.sharedAllocator.validateRatioIssues()
    const expiredAdjustments = this.manualAdjManager.getExpiredAdjustments()

    const errors = issues.filter(i => i.severity === 'error')
    const canProceed = errors.length === 0

    return {
      issues,
      mappingGaps,
      unknownApis,
      ratioIssues,
      expiredAdjustments,
      canProceed
    }
  }

  calculate(ctx: CalculationContext): CalculationResult {
    this.loadContext(ctx)

    const totalRawLogs = ctx.logs.length
    const { deduplicated: logs, issues: logIssues } = this.logProcessor.deduplicate()

    const allIssues = [...logIssues]

    const charges: ChargeDetail[] = []
    const unsettledItems: UnsettledItem[] = []
    const sharedPoolLogs = new Map<string, ApiLog[]>()

    const teamCallVolumes = new Map<string, number>()
    const knownTeamLogs = logs.filter(log => {
      const mapping = this.teamMapper.findMappingForLog(log)
      if (mapping) {
        teamCallVolumes.set(mapping.teamId, (teamCallVolumes.get(mapping.teamId) || 0) + 1)
        return true
      }
      return false
    })

    for (const log of logs) {
      const rule = this.costRuleEngine.findRuleForLog(log)
      const mapping = this.teamMapper.findMappingForLog(log)
      const rawCost = rule ? this.costRuleEngine.calculateLogCost(log, rule) : 0

      if (rule && rule.costModel.type === 'sharedPool') {
        const existing = sharedPoolLogs.get('pool-platform-shared') || []
        existing.push(log)
        sharedPoolLogs.set('pool-platform-shared', existing)
        continue
      }

      const manualAdjs = this.manualAdjManager.getAdjustmentsForLog(log.requestId, log.appId, log.apiName)
      const hasManualAdj = manualAdjs.length > 0

      let allocationStatus: ChargeDetail['allocationStatus']
      let chargeSource: ChargeDetail['chargeSource']
      let teamId: string | null = null
      let teamName: string | null = null
      let businessLine: string | null = null
      let notes = ''

      if (hasManualAdj) {
        const adj = manualAdjs[0]
        allocationStatus = 'settled'
        chargeSource = 'manual_adjustment'
        teamId = adj.targetTeamId
        teamName = adj.targetTeamName
        businessLine = adj.targetBusinessLine
        notes = `人工归属: ${adj.reason}`
      } else if (mapping && rule) {
        allocationStatus = 'settled'
        chargeSource = 'direct'
        teamId = mapping.teamId
        teamName = mapping.teamName
        businessLine = mapping.businessLine
      } else if (mapping && !rule) {
        allocationStatus = 'unsettled'
        chargeSource = 'unsettled'
        teamId = mapping.teamId
        teamName = mapping.teamName
        businessLine = mapping.businessLine
        notes = '缺少成本规则'
      } else {
        allocationStatus = 'unsettled'
        chargeSource = 'unsettled'
        notes = '未知 appId'
      }

      const charge: ChargeDetail = {
        id: `charge-${log.requestId}`,
        requestId: log.requestId,
        appId: log.appId,
        apiName: log.apiName,
        timestamp: log.timestamp,
        duration: log.duration,
        rawCost,
        costRuleVersion: rule ? rule.version : 0,
        teamId,
        teamName,
        businessLine,
        allocationStatus,
        chargeSource,
        sharedPoolId: null,
        manualAdjId: hasManualAdj ? manualAdjs[0].id : null,
        notes
      }

      charges.push(charge)

      if (allocationStatus === 'unsettled') {
        unsettledItems.push({
          requestId: log.requestId,
          appId: log.appId,
          apiName: log.apiName,
          cost: rawCost,
          reason: notes || '无法分配'
        })
      }
    }

    const sharedPoolBreakdowns = this.sharedAllocator.getPools().map(pool => {
      const poolLogs = sharedPoolLogs.get(pool.poolId) || []
      const estimatedPoolCost = poolLogs.length * 0.5
      const breakdown = this.sharedAllocator.allocatePoolCost(pool, estimatedPoolCost, teamCallVolumes)

      for (const alloc of breakdown.allocations) {
        const teamMapping = this.teamMapper.getTeamInfo(alloc.teamId)
        if (teamMapping) {
          const poolCharge: ChargeDetail = {
            id: `charge-pool-${pool.poolId}-${alloc.teamId}`,
            requestId: `pool-${pool.poolId}`,
            appId: 'pool-shared',
            apiName: pool.poolName,
            timestamp: ctx.periodStart,
            duration: 0,
            rawCost: alloc.amount,
            costRuleVersion: 1,
            teamId: alloc.teamId,
            teamName: teamMapping.teamName,
            businessLine: teamMapping.businessLine,
            allocationStatus: 'settled',
            chargeSource: 'shared_pool',
            sharedPoolId: pool.poolId,
            manualAdjId: null,
            notes: breakdown.explanation
          }
          charges.push(poolCharge)
        }
      }

      return breakdown
    })

    const teamBillMap = new Map<string, TeamBill>()
    for (const charge of charges) {
      if (!charge.teamId) continue

      const bill = teamBillMap.get(charge.teamId) || {
        teamId: charge.teamId,
        teamName: charge.teamName || charge.teamId,
        businessLine: charge.businessLine || '未知业务线',
        totalAmount: 0,
        directCost: 0,
        sharedPoolCost: 0,
        manualAdjustment: 0,
        unsettledAmount: 0,
        chargeCount: 0,
        settlementStatus: 'settled' as const
      }

      bill.totalAmount += charge.rawCost
      bill.chargeCount += 1

      if (charge.chargeSource === 'direct') bill.directCost += charge.rawCost
      if (charge.chargeSource === 'shared_pool') bill.sharedPoolCost += charge.rawCost
      if (charge.chargeSource === 'manual_adjustment') bill.manualAdjustment += charge.rawCost
      if (charge.allocationStatus === 'unsettled') bill.unsettledAmount += charge.rawCost

      teamBillMap.set(charge.teamId, bill)
    }

    const teamBills = Array.from(teamBillMap.values()).map(bill => ({
      ...bill,
      settlementStatus: (bill.unsettledAmount > 0 
        ? (bill.directCost + bill.sharedPoolCost + bill.manualAdjustment > 0 
            ? 'partially_settled' 
            : 'unsettled')
        : 'settled') as 'settled' | 'partially_settled' | 'unsettled'
    }))

    const apiSummaryMap = new Map<string, ApiCostSummary>()
    for (const charge of charges) {
      if (charge.apiName === '平台共享资源池') continue

      const summary = apiSummaryMap.get(charge.apiName) || {
        apiName: charge.apiName,
        totalCalls: 0,
        uniqueAppIds: [],
        totalCost: 0,
        settledCost: 0,
        unsettledCost: 0,
        costRuleVersions: []
      }

      summary.totalCalls += 1
      summary.totalCost += charge.rawCost

      if (!summary.uniqueAppIds.includes(charge.appId)) {
        summary.uniqueAppIds.push(charge.appId)
      }

      if (!summary.costRuleVersions.includes(charge.costRuleVersion)) {
        summary.costRuleVersions.push(charge.costRuleVersion)
      }

      if (charge.allocationStatus === 'settled') {
        summary.settledCost += charge.rawCost
      } else {
        summary.unsettledCost += charge.rawCost
      }

      apiSummaryMap.set(charge.apiName, summary)
    }
    const apiSummaries = Array.from(apiSummaryMap.values())

    const blSummaryMap = new Map<string, BusinessLineSummary>()
    for (const bill of teamBills) {
      const summary = blSummaryMap.get(bill.businessLine) || {
        businessLine: bill.businessLine,
        teams: [],
        totalCost: 0,
        directCost: 0,
        sharedPoolCost: 0
      }

      if (!summary.teams.includes(bill.teamName)) {
        summary.teams.push(bill.teamName)
      }

      summary.totalCost += bill.totalAmount
      summary.directCost += bill.directCost
      summary.sharedPoolCost += bill.sharedPoolCost

      blSummaryMap.set(bill.businessLine, summary)
    }
    const businessLineSummaries = Array.from(blSummaryMap.values())

    const totalCost = charges.reduce((sum, c) => sum + c.rawCost, 0)
    const settledCost = charges
      .filter(c => c.allocationStatus === 'settled')
      .reduce((sum, c) => sum + c.rawCost, 0)
    const unsettledCost = totalCost - settledCost

    return {
      context: {
        periodStart: ctx.periodStart,
        periodEnd: ctx.periodEnd,
        totalRawLogs,
        deduplicatedLogs: logs.length,
        totalCalls: logs.length
      },
      summary: {
        totalCost: Math.round(totalCost * 10000) / 10000,
        settledCost: Math.round(settledCost * 10000) / 10000,
        unsettledCost: Math.round(unsettledCost * 10000) / 10000,
        settlementRate: totalCost > 0 ? Math.round((settledCost / totalCost) * 10000) / 100 : 0
      },
      teamBills,
      apiSummaries,
      businessLineSummaries,
      charges,
      unsettledItems,
      sharedPoolBreakdowns,
      issues: allIssues
    }
  }

  computeDiff(
    previousResult: CalculationResult,
    currentResult: CalculationResult
  ): RecomputeDiff[] {
    const diffs: RecomputeDiff[] = []

    const prevBills = new Map(previousResult.teamBills.map(b => [b.teamId, b]))
    const currBills = new Map(currentResult.teamBills.map(b => [b.teamId, b]))

    const allTeamIds = new Set([...prevBills.keys(), ...currBills.keys()])

    for (const teamId of allTeamIds) {
      const prev = prevBills.get(teamId)
      const curr = currBills.get(teamId)

      const previousAmount = prev?.totalAmount || 0
      const currentAmount = curr?.totalAmount || 0
      const difference = currentAmount - previousAmount

      const changeReasons: string[] = []

      if (prev && curr) {
        if (curr.directCost !== prev.directCost) {
          changeReasons.push(`直接成本变化: ${prev.directCost} → ${curr.directCost}`)
        }
        if (curr.sharedPoolCost !== prev.sharedPoolCost) {
          changeReasons.push(`共享成本变化: ${prev.sharedPoolCost} → ${curr.sharedPoolCost}`)
        }
        if (curr.manualAdjustment !== prev.manualAdjustment) {
          changeReasons.push(`人工调整变化: ${prev.manualAdjustment} → ${curr.manualAdjustment}`)
        }
      } else if (!prev) {
        changeReasons.push('新增团队账单')
      } else {
        changeReasons.push('团队账单移除')
      }

      diffs.push({
        teamId,
        teamName: curr?.teamName || prev?.teamName || teamId,
        previousAmount,
        currentAmount,
        difference,
        changeReasons
      })
    }

    return diffs
  }
}
