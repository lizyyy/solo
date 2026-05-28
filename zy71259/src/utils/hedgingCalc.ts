import type { Subsidiary, Currency, Exposure, HedgeContract, ExchangeRate, Anomaly, TreeNodeData, ExposureSummary } from '@/types'

export function buildTreeData(
  subsidiaries: Subsidiary[],
  currencies: Currency[],
  exposures: Exposure[],
  hedgeContracts: HedgeContract[],
  selectedCurrencies: string[],
  selectedSubsidiaryCodes: string[],
  selectedDirections: string[]
): TreeNodeData {
  const filteredExposures = exposures.filter((e) => {
    if (selectedCurrencies.length > 0 && !selectedCurrencies.includes(e.currencyCode)) return false
    if (selectedSubsidiaryCodes.length > 0 && !selectedSubsidiaryCodes.includes(e.subsidiaryCode)) return false
    if (selectedDirections.length > 0 && !selectedDirections.includes(e.direction)) return false
    return true
  })

  const root: TreeNodeData = {
    id: 'root',
    label: '集团总部',
    type: 'root',
    position: [0, 0, 0],
    size: 1.5,
    color: '#4A90D9',
    children: [],
  }

  const filteredSubs = selectedSubsidiaryCodes.length > 0
    ? subsidiaries.filter((s) => selectedSubsidiaryCodes.includes(s.code))
    : subsidiaries

  const subAngle = (2 * Math.PI) / Math.max(filteredSubs.length, 1)
  const subRadius = 5

  filteredSubs.forEach((sub, i) => {
    const angle = subAngle * i - Math.PI / 2
    const subExposures = filteredExposures.filter((e) => e.subsidiaryCode === sub.code)

    const curMap = new Map<string, Exposure[]>()
    subExposures.forEach((e) => {
      const arr = curMap.get(e.currencyCode) || []
      arr.push(e)
      curMap.set(e.currencyCode, arr)
    })

    let filteredCurCodes = Array.from(curMap.keys())
    if (selectedCurrencies.length > 0) {
      filteredCurCodes = filteredCurCodes.filter((c) => selectedCurrencies.includes(c))
    }

    const subNode: TreeNodeData = {
      id: `sub|${sub.code}`,
      label: sub.name,
      type: 'subsidiary',
      position: [Math.cos(angle) * subRadius, 0, Math.sin(angle) * subRadius],
      size: 0.8,
      color: '#5B9BD5',
      subsidiaryId: sub.code,
      children: [],
    }

    const curAngle = (Math.PI * 1.2) / Math.max(filteredCurCodes.length, 1)
    const baseAngle = angle - (Math.PI * 0.6)
    const curRadius = 3

    filteredCurCodes.forEach((curCode, j) => {
      const curExps = curMap.get(curCode) || []
      const longAmt = curExps.filter((e) => e.direction === 'LONG').reduce((s, e) => s + e.amount, 0)
      const shortAmt = curExps.filter((e) => e.direction === 'SHORT').reduce((s, e) => s + e.amount, 0)
      const net = longAmt - shortAmt
      const hasHedge = curExps.some((e) => e.hedged) || hedgeContracts.some((h) => h.subsidiaryCode === sub.code && h.currencyCode === curCode)
      const cAngle = baseAngle + curAngle * j
      const sx = subNode.position[0] + Math.cos(cAngle) * curRadius
      const sz = subNode.position[2] + Math.sin(cAngle) * curRadius

      subNode.children.push({
        id: `cur|${sub.code}|${curCode}`,
        label: curCode,
        type: 'currency',
        position: [sx, 0, sz],
        size: Math.max(0.3, Math.min(1.2, Math.log10(Math.abs(net) + 1) * 0.3)),
        color: net >= 0 ? '#00E5A0' : '#FF6B6B',
        direction: net >= 0 ? 'LONG' : 'SHORT',
        subsidiaryId: sub.code,
        currencyCode: curCode,
        netExposure: net,
        hedged: hasHedge,
        children: [],
      })
    })

    root.children.push(subNode)
  })

  return root
}

export function calcSummary(exposures: Exposure[], _hedgeContracts: HedgeContract[]): ExposureSummary {
  const totalLong = exposures.filter((e) => e.direction === 'LONG').reduce((s, e) => s + e.amount, 0)
  const totalShort = exposures.filter((e) => e.direction === 'SHORT').reduce((s, e) => s + e.amount, 0)
  const netExposure = totalLong - totalShort
  const totalExposure = totalLong + totalShort
  const naturalHedgeRatio = totalExposure > 0 ? 1 - Math.abs(netExposure) / totalExposure : 0
  const hedgedAmount = exposures.filter((e) => e.hedged).reduce((s, e) => s + e.amount, 0)
  const hedgeCoverageRatio = totalExposure > 0 ? hedgedAmount / totalExposure : 0
  const naturalHedgeSavings = Math.abs(netExposure) * 0.05

  return { totalLong, totalShort, netExposure, naturalHedgeRatio, hedgeCoverageRatio, naturalHedgeSavings }
}

export function detectAnomalies(
  subsidiaries: Subsidiary[],
  exposures: Exposure[],
  hedgeContracts: HedgeContract[],
  exchangeRates: ExchangeRate[]
): Anomaly[] {
  const anomalies: Anomaly[] = []
  let idx = 0

  const curPairs = new Map<string, number>()
  exchangeRates.forEach((r) => curPairs.set(r.pair, r.spotRate))

  exposures.forEach((exp) => {
    const sub = subsidiaries.find((s) => s.code === exp.subsidiaryCode)
    if (!sub) return
    const pair = exp.currencyCode + sub.functionalCurrency
    const rate = curPairs.get(pair) || curPairs.get(sub.functionalCurrency + exp.currencyCode)
    if (rate) {
      const convertedAmt = exp.amount * rate
      if (convertedAmt === 0 && exp.amount !== 0) {
        anomalies.push({
          id: `anomaly-${idx++}`,
          type: 'TRANSLATION_ERROR',
          relatedEntityId: exp.id,
          description: `${sub.name} ${exp.currencyCode}敞口金额${exp.amount}折算为${sub.functionalCurrency}后为0，可能存在汇率折算错误`,
          severity: 'HIGH',
          resolution: 'UNRESOLVED',
          userNote: '',
        })
      }
    }
  })

  const contractMap = new Map<string, HedgeContract[]>()
  hedgeContracts.forEach((h) => {
    const arr = contractMap.get(h.contractNo) || []
    arr.push(h)
    contractMap.set(h.contractNo, arr)
  })
  contractMap.forEach((contracts, contractNo) => {
    if (contracts.length > 1) {
      anomalies.push({
        id: `anomaly-${idx++}`,
        type: 'DUPLICATE_HEDGE',
        relatedEntityId: contractNo,
        description: `套保合约${contractNo}出现${contracts.length}次，可能存在重复记录`,
        severity: 'HIGH',
        resolution: 'UNRESOLVED',
        userNote: '',
      })
    }
  })

  const subCurrencyPairs = new Map<string, HedgeContract[]>()
  hedgeContracts.forEach((h) => {
    const key = `${h.subsidiaryCode}-${h.currencyCode}-${h.dueDate}`
    const arr = subCurrencyPairs.get(key) || []
    arr.push(h)
    subCurrencyPairs.set(key, arr)
  })
  subCurrencyPairs.forEach((contracts, key) => {
    if (contracts.length > 1) {
      const uniqueAmounts = new Set(contracts.map((c) => c.notionalAmount))
      if (uniqueAmounts.size > 1) {
        anomalies.push({
          id: `anomaly-${idx++}`,
          type: 'DUPLICATE_HEDGE',
          relatedEntityId: key,
          description: `同子公司同币种同到期日存在多名义金额套保合约，请核实：${contracts.map((c) => c.contractNo).join(', ')}`,
          severity: 'MEDIUM',
          resolution: 'UNRESOLVED',
          userNote: '',
        })
      }
    }
  })

  subsidiaries.forEach((sub) => {
    const hasExposure = exposures.some((e) => e.subsidiaryCode === sub.code)
    if (!hasExposure && subsidiaries.length > 1) {
      anomalies.push({
        id: `anomaly-${idx++}`,
        type: 'CONSOLIDATION_OMISSION',
        relatedEntityId: sub.code,
        description: `子公司${sub.name}(${sub.code})无敞口数据，可能存在合并遗漏`,
        severity: 'MEDIUM',
        resolution: 'UNRESOLVED',
        userNote: '',
      })
    }
  })

  return anomalies
}

export function generateDemoData(): {
  subsidiaries: Subsidiary[]
  currencies: Currency[]
  exposures: Exposure[]
  hedgeContracts: HedgeContract[]
  exchangeRates: ExchangeRate[]
} {
  const subsidiaries: Subsidiary[] = [
    { id: 's1', code: 'CN-BJ', name: '北京总部', region: '亚太', functionalCurrency: 'CNY', consolidationLevel: 0 },
    { id: 's2', code: 'US-NY', name: '纽约分公司', region: '北美', functionalCurrency: 'USD', consolidationLevel: 1 },
    { id: 's3', code: 'EU-FR', name: '法兰克福分公司', region: '欧洲', functionalCurrency: 'EUR', consolidationLevel: 1 },
    { id: 's4', code: 'JP-TK', name: '东京分公司', region: '亚太', functionalCurrency: 'JPY', consolidationLevel: 1 },
    { id: 's5', code: 'UK-LD', name: '伦敦分公司', region: '欧洲', functionalCurrency: 'GBP', consolidationLevel: 1 },
    { id: 's6', code: 'SG-SN', name: '新加坡分公司', region: '亚太', functionalCurrency: 'SGD', consolidationLevel: 1 },
  ]

  const currencies: Currency[] = [
    { code: 'USD', name: '美元' },
    { code: 'EUR', name: '欧元' },
    { code: 'JPY', name: '日元' },
    { code: 'GBP', name: '英镑' },
    { code: 'CNY', name: '人民币' },
    { code: 'SGD', name: '新加坡元' },
  ]

  const exposures: Exposure[] = [
    { id: 'e1', subsidiaryCode: 'CN-BJ', subsidiaryId: 'CN-BJ', currencyCode: 'USD', amount: 5000000, direction: 'LONG', dueDate: '2026-06-30', contractNo: '', originalRaw: '5000000', manualNote: 'Q2对美出口应收', source: 'demo', hedged: true, hedgeContractNo: 'HC-001' },
    { id: 'e2', subsidiaryCode: 'CN-BJ', subsidiaryId: 'CN-BJ', currencyCode: 'EUR', amount: 3000000, direction: 'LONG', dueDate: '2026-07-15', contractNo: '', originalRaw: '3000000', manualNote: '', source: 'demo', hedged: false, hedgeContractNo: '' },
    { id: 'e3', subsidiaryCode: 'CN-BJ', subsidiaryId: 'CN-BJ', currencyCode: 'USD', amount: 2000000, direction: 'SHORT', dueDate: '2026-06-30', contractNo: '', originalRaw: '2000000', manualNote: '设备采购应付', source: 'demo', hedged: false, hedgeContractNo: '' },
    { id: 'e4', subsidiaryCode: 'US-NY', subsidiaryId: 'US-NY', currencyCode: 'EUR', amount: 8000000, direction: 'LONG', dueDate: '2026-06-15', contractNo: '', originalRaw: '8000000', manualNote: '', source: 'demo', hedged: true, hedgeContractNo: 'HC-002' },
    { id: 'e5', subsidiaryCode: 'US-NY', subsidiaryId: 'US-NY', currencyCode: 'CNY', amount: 4000000, direction: 'SHORT', dueDate: '2026-07-01', contractNo: '', originalRaw: '4000000', manualNote: '中国供应商付款', source: 'demo', hedged: false, hedgeContractNo: '' },
    { id: 'e6', subsidiaryCode: 'US-NY', subsidiaryId: 'US-NY', currencyCode: 'JPY', amount: 600000000, direction: 'LONG', dueDate: '2026-08-01', contractNo: '', originalRaw: '600000000', manualNote: '', source: 'demo', hedged: false, hedgeContractNo: '' },
    { id: 'e7', subsidiaryCode: 'EU-FR', subsidiaryId: 'EU-FR', currencyCode: 'USD', amount: 12000000, direction: 'SHORT', dueDate: '2026-06-30', contractNo: '', originalRaw: '12000000', manualNote: '对美进口应付', source: 'demo', hedged: true, hedgeContractNo: 'HC-003' },
    { id: 'e8', subsidiaryCode: 'EU-FR', subsidiaryId: 'EU-FR', currencyCode: 'GBP', amount: 5000000, direction: 'LONG', dueDate: '2026-07-15', contractNo: '', originalRaw: '5000000', manualNote: '', source: 'demo', hedged: false, hedgeContractNo: '' },
    { id: 'e9', subsidiaryCode: 'JP-TK', subsidiaryId: 'JP-TK', currencyCode: 'USD', amount: 3000000, direction: 'SHORT', dueDate: '2026-06-30', contractNo: '', originalRaw: '3000000', manualNote: '', source: 'demo', hedged: false, hedgeContractNo: '' },
    { id: 'e10', subsidiaryCode: 'JP-TK', subsidiaryId: 'JP-TK', currencyCode: 'CNY', amount: 2000000, direction: 'LONG', dueDate: '2026-07-01', contractNo: '', originalRaw: '2000000', manualNote: '对华出口', source: 'demo', hedged: false, hedgeContractNo: '' },
    { id: 'e11', subsidiaryCode: 'UK-LD', subsidiaryId: 'UK-LD', currencyCode: 'EUR', amount: 7000000, direction: 'SHORT', dueDate: '2026-06-30', contractNo: '', originalRaw: '7000000', manualNote: '', source: 'demo', hedged: true, hedgeContractNo: 'HC-004' },
    { id: 'e12', subsidiaryCode: 'UK-LD', subsidiaryId: 'UK-LD', currencyCode: 'USD', amount: 4000000, direction: 'LONG', dueDate: '2026-07-15', contractNo: '', originalRaw: '4000000', manualNote: '', source: 'demo', hedged: false, hedgeContractNo: '' },
  ]

  const hedgeContracts: HedgeContract[] = [
    { id: 'h1', contractNo: 'HC-001', subsidiaryCode: 'CN-BJ', subsidiaryId: 'CN-BJ', currencyCode: 'USD', notionalAmount: 5000000, direction: 'SHORT', dueDate: '2026-06-30', hedgeType: '远期', counterparty: '中行', originalRaw: 'HC-001', manualNote: '' },
    { id: 'h2', contractNo: 'HC-002', subsidiaryCode: 'US-NY', subsidiaryId: 'US-NY', currencyCode: 'EUR', notionalAmount: 8000000, direction: 'SHORT', dueDate: '2026-06-15', hedgeType: '期权', counterparty: '花旗', originalRaw: 'HC-002', manualNote: '' },
    { id: 'h3', contractNo: 'HC-003', subsidiaryCode: 'EU-FR', subsidiaryId: 'EU-FR', currencyCode: 'USD', notionalAmount: 12000000, direction: 'LONG', dueDate: '2026-06-30', hedgeType: '远期', counterparty: '德银', originalRaw: 'HC-003', manualNote: '' },
    { id: 'h4', contractNo: 'HC-004', subsidiaryCode: 'UK-LD', subsidiaryId: 'UK-LD', currencyCode: 'EUR', notionalAmount: 7000000, direction: 'LONG', dueDate: '2026-06-30', hedgeType: '互换', counterparty: '巴克莱', originalRaw: 'HC-004', manualNote: '' },
    { id: 'h5', contractNo: 'HC-002', subsidiaryCode: 'US-NY', subsidiaryId: 'US-NY', currencyCode: 'EUR', notionalAmount: 4000000, direction: 'SHORT', dueDate: '2026-06-15', hedgeType: '远期', counterparty: '汇丰', originalRaw: 'HC-002-duplicate', manualNote: '疑似重复录入，待核实' },
  ]

  const exchangeRates: ExchangeRate[] = [
    { id: 'r1', pair: 'USDCNY', spotRate: 7.25, forwardRate: 7.30, rateDate: '2026-05-28' },
    { id: 'r2', pair: 'EURUSD', spotRate: 1.08, forwardRate: 1.09, rateDate: '2026-05-28' },
    { id: 'r3', pair: 'GBPUSD', spotRate: 1.27, forwardRate: 1.28, rateDate: '2026-05-28' },
    { id: 'r4', pair: 'USDJPY', spotRate: 155.0, forwardRate: 156.0, rateDate: '2026-05-28' },
  ]

  return { subsidiaries, currencies, exposures, hedgeContracts, exchangeRates }
}
