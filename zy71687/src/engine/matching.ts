import type {
  PlatformTransaction,
  ForwardContract,
  WithdrawalRecord,
  SettlementPlan,
  ExceptionRecord,
  SpotRate,
  GapWarning,
} from '../data/types'

const RATE_DATE_THRESHOLD_DAYS = 30
const RATE_VOLATILITY_THRESHOLD = 0.02

function daysBetween(a: string, b: string): number {
  const da = new Date(a).getTime()
  const db = new Date(b).getTime()
  return Math.abs(db - da) / (1000 * 60 * 60 * 24)
}

function getSpotRate(currency: string, spotRates: SpotRate[]): number {
  return spotRates.find((r) => r.currency === currency)?.rate ?? 0
}

export interface MatchResult {
  plans: SettlementPlan[]
  exceptions: ExceptionRecord[]
  updatedContracts: ForwardContract[]
  warnings: GapWarning[]
}

export function runMatching(
  transactions: PlatformTransaction[],
  contracts: ForwardContract[],
  withdrawals: WithdrawalRecord[],
  spotRates: SpotRate[]
): MatchResult {
  const plans: SettlementPlan[] = []
  const exceptions: ExceptionRecord[] = []
  const updatedContracts: ForwardContract[] = contracts.map((c) => ({ ...c }))
  const warnings: GapWarning[] = []
  const matchedOrderIds = new Set<string>()
  const orderContractMap = new Map<string, string[]>()

  const arrivedWithdrawals = withdrawals.filter((w) => w.status === 'arrived' || w.status === 'delayed')

  const delayedWithdrawals = withdrawals.filter((w) => w.status === 'delayed')
  for (const dw of delayedWithdrawals) {
    exceptions.push({
      id: `EX-WD-${dw.id}`,
      type: 'withdrawal_delay',
      description: `${dw.platform} ${dw.currency} ${dw.amount.toLocaleString()} 提现延迟`,
      impactAmount: dw.amount,
      impactCurrency: dw.currency,
      reason: dw.delayReason ?? '提现未按时到账',
      relatedTransactionId: null,
      relatedForwardId: null,
      relatedWithdrawalId: dw.id,
      status: 'unresolved',
    })
  }

  const collectedTxns = transactions.filter((t) => t.status === 'collected')

  const contractsByCurrency = new Map<string, ForwardContract[]>()
  for (const c of updatedContracts) {
    if (c.status !== 'active') continue
    const list = contractsByCurrency.get(c.currency) ?? []
    list.push(c)
    contractsByCurrency.set(c.currency, list)
  }

  for (const [, list] of contractsByCurrency) {
    list.sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime())
  }

  for (const tx of collectedTxns) {
    const wd = arrivedWithdrawals.find(
      (w) => w.platform === tx.platform && w.currency === tx.currency
    )
    if (!wd) continue

    const activeContracts = contractsByCurrency.get(tx.currency) ?? []
    let matched: ForwardContract | null = null

    for (const c of activeContracts) {
      if (c.status !== 'active') continue
      if (c.amount >= tx.amount) {
        matched = c
        break
      }
    }

    if (matched) {
      const existingMapping = orderContractMap.get(tx.id)
      if (existingMapping) {
        const duplicateContract = updatedContracts.find((c) => c.id === matched!.id)!
        duplicateContract.status = 'duplicate_error'
        exceptions.push({
          id: `EX-DUP-${tx.id}-${matched.id}`,
          type: 'forward_duplicate',
          description: `订单 ${tx.orderId} 已有锁汇合约 ${existingMapping.join(',')}，合约 ${matched.id} 重复匹配`,
          impactAmount: tx.amount,
          impactCurrency: tx.currency,
          reason: '同一订单被多个锁汇合约匹配，保留最早签约合约',
          relatedTransactionId: tx.id,
          relatedForwardId: matched.id,
          relatedWithdrawalId: wd.id,
          status: 'unresolved',
        })
      } else {
        const contractAge = daysBetween(matched.contractDate, wd.actualArrivalDate)
        const rateDiff = Math.abs(matched.lockedRate - getSpotRate(tx.currency, spotRates)) / getSpotRate(tx.currency, spotRates)

        if (contractAge > RATE_DATE_THRESHOLD_DAYS && rateDiff > RATE_VOLATILITY_THRESHOLD) {
          const rateErrContract = updatedContracts.find((c) => c.id === matched!.id)!
          rateErrContract.status = 'rate_date_error'
          exceptions.push({
            id: `EX-RATE-${tx.id}-${matched.id}`,
            type: 'rate_date_error',
            description: `合约 ${matched.id} 签约日与到账日相差${Math.round(contractAge)}天，汇率偏差${(rateDiff * 100).toFixed(1)}%`,
            impactAmount: tx.amount,
            impactCurrency: tx.currency,
            reason: `锁汇签约日(${matched.contractDate})距到账日(${wd.actualArrivalDate})超过${RATE_DATE_THRESHOLD_DAYS}天，期间汇率波动${(rateDiff * 100).toFixed(1)}%超过阈值${(RATE_VOLATILITY_THRESHOLD * 100).toFixed(0)}%，汇率日期标记可能错误`,
            relatedTransactionId: tx.id,
            relatedForwardId: matched.id,
            relatedWithdrawalId: wd.id,
            status: 'unresolved',
          })

          plans.push({
            id: `SP-${tx.id}`,
            transactionId: tx.id,
            forwardContractId: matched.id,
            withdrawalId: wd.id,
            currency: tx.currency,
            amount: tx.amount,
            settledRate: matched.lockedRate,
            settledAmountCNY: tx.amount * matched.lockedRate,
            plannedDate: matched.expiryDate,
            status: 'skipped_exception',
            exceptionReason: `汇率日期错误：签约日距到账日${Math.round(contractAge)}天，汇率偏差${(rateDiff * 100).toFixed(1)}%`,
          })
        } else {
          const matchContract = updatedContracts.find((c) => c.id === matched!.id)!
          matchContract.status = 'matched'
          matchContract.matchedOrderId = tx.id

          orderContractMap.set(tx.id, [...(orderContractMap.get(tx.id) ?? []), matched.id])

          plans.push({
            id: `SP-${tx.id}`,
            transactionId: tx.id,
            forwardContractId: matched.id,
            withdrawalId: wd.id,
            currency: tx.currency,
            amount: tx.amount,
            settledRate: matched.lockedRate,
            settledAmountCNY: tx.amount * matched.lockedRate,
            plannedDate: new Date(
              new Date(matched.expiryDate).getTime() - 5 * 24 * 60 * 60 * 1000
            )
              .toISOString()
              .slice(0, 10),
            status: 'planned',
            exceptionReason: null,
          })
        }
      }
    } else {
      const spot = getSpotRate(tx.currency, spotRates)
      plans.push({
        id: `SP-${tx.id}`,
        transactionId: tx.id,
        forwardContractId: null,
        withdrawalId: wd.id,
        currency: tx.currency,
        amount: tx.amount,
        settledRate: spot,
        settledAmountCNY: tx.amount * spot,
        plannedDate: wd.actualArrivalDate,
        status: 'planned',
        exceptionReason: null,
      })

      warnings.push({
        type: 'uncovered',
        currency: tx.currency,
        amount: tx.amount,
        description: `${tx.currency} ${tx.amount.toLocaleString()} 无锁汇覆盖，按即期汇率${spot}结汇`,
        relatedIds: [tx.id],
      })
    }
  }

  const unmatchedContracts = updatedContracts.filter(
    (c) => c.status === 'active' && c.matchedOrderId === null
  )
  for (const uc of unmatchedContracts) {
    const daysToExpiry = daysBetween(new Date().toISOString().slice(0, 10), uc.expiryDate)
    if (daysToExpiry < 7) {
      warnings.push({
        type: 'expiring_soon',
        currency: uc.currency,
        amount: uc.amount,
        description: `合约 ${uc.id} 将于 ${uc.expiryDate} 到期，剩余${Math.round(daysToExpiry)}天`,
        relatedIds: [uc.id],
      })
    }
  }

  for (const uc of unmatchedContracts.filter((c) => daysBetween(new Date().toISOString().slice(0, 10), c.expiryDate) >= 7)) {
    warnings.push({
      type: 'available_forward',
      currency: uc.currency,
      amount: uc.amount,
      description: `可用锁汇合约 ${uc.id}：${uc.currency} ${uc.amount.toLocaleString()} @ ${uc.lockedRate}，到期 ${uc.expiryDate}`,
      relatedIds: [uc.id],
    })
  }

  return { plans, exceptions, updatedContracts, warnings }
}
