import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  Sample, Contract, Platform, Royalty, Release, RiskItem,
  ContractStatus, SampleStatus, PlatformStatus, RiskType, RiskSeverity
} from '@/types'

const today = new Date()
const fmt = (d: Date) => d.toISOString().slice(0, 10)
const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r }
const pastDate = (n: number) => fmt(addDays(today, -n))
const futureDate = (n: number) => fmt(addDays(today, n))

const INITIAL_CONTRACTS: Contract[] = [
  { id: 'c1', contractNo: 'H-2024-001', licensor: '华纳音乐版权', licensee: '星辰音乐工作室', authType: '独家授权', startDate: pastDate(180), endDate: futureDate(185), status: 'active', attachments: ['授权协议扫描件.pdf'] },
  { id: 'c2', contractNo: 'H-2024-002', licensor: '索尼音乐出版', licensee: '星辰音乐工作室', authType: '非独家授权', startDate: pastDate(365), endDate: futureDate(20), status: 'expiring', attachments: ['授权书.pdf', '补充协议.pdf'] },
  { id: 'c3', contractNo: 'H-2024-003', licensor: '环球音乐版权', licensee: '星辰音乐工作室', authType: '独家授权', startDate: pastDate(400), endDate: pastDate(5), status: 'expired', attachments: [] },
  { id: 'c4', contractNo: 'H-2024-004', licensor: '滚石唱片', licensee: '星辰音乐工作室', authType: '待签署', startDate: '', endDate: '', status: 'pending', attachments: [] },
]

const INITIAL_SAMPLES: Sample[] = [
  { id: 's1', title: '夜曲片段', originalWork: '夜曲', originalArtist: '周杰伦', sampleType: '旋律采样', sourceLabel: '杰威尔音乐', contractId: 'c1', royaltyIds: ['r1', 'r2'], status: 'complete', notes: '副歌4小节旋律采样' },
  { id: 's2', title: '光年之外前奏', originalWork: '光年之外', originalArtist: '邓紫棋', sampleType: '和声采样', sourceLabel: '蜂鸟音乐', contractId: 'c2', royaltyIds: ['r3'], status: 'complete', notes: '前奏8小节和声采样' },
  { id: 's3', title: '泡沫鼓点', originalWork: '泡沫', originalArtist: '邓紫棋', sampleType: '节奏采样', sourceLabel: '蜂鸟音乐', contractId: 'c3', royaltyIds: [], status: 'at_risk', notes: '鼓点节奏型采样' },
  { id: 's4', title: '红豆人声', originalWork: '红豆', originalArtist: '王菲', sampleType: '人声采样', sourceLabel: '百代音乐', contractId: 'c4', royaltyIds: ['r4'], status: 'incomplete', notes: '副歌人声片段' },
  { id: 's5', title: '江南间奏', originalWork: '江南', originalArtist: '林俊杰', sampleType: '旋律采样', sourceLabel: '海蝶音乐', contractId: 'c1', royaltyIds: ['r5', 'r6'], status: 'complete', notes: '间奏6小节采样' },
]

const INITIAL_PLATFORMS: Platform[] = [
  { id: 'p1', name: '网易云音乐', type: '流媒体', region: '中国大陆', contractId: 'c1', startDate: pastDate(180), endDate: futureDate(185), status: 'active' },
  { id: 'p2', name: 'QQ音乐', type: '流媒体', region: '中国大陆', contractId: 'c1', startDate: pastDate(180), endDate: futureDate(185), status: 'active' },
  { id: 'p3', name: '酷狗音乐', type: '流媒体', region: '中国大陆', contractId: 'c2', startDate: pastDate(365), endDate: futureDate(20), status: 'active' },
  { id: 'p4', name: 'Spotify', type: '流媒体', region: '全球', contractId: 'c2', startDate: pastDate(365), endDate: futureDate(20), status: 'active' },
  { id: 'p5', name: 'Apple Music', type: '流媒体', region: '全球', contractId: 'c1', startDate: pastDate(180), endDate: futureDate(185), status: 'active' },
  { id: 'p6', name: '抖音', type: '短视频', region: '中国大陆', contractId: 'c3', startDate: pastDate(400), endDate: pastDate(5), status: 'expired' },
  { id: 'p7', name: 'YouTube Music', type: '流媒体', region: '全球', contractId: 'c2', startDate: pastDate(365), endDate: futureDate(20), status: 'active' },
]

const INITIAL_ROYALTIES: Royalty[] = [
  { id: 'r1', sampleId: 's1', rightHolder: '华纳音乐版权', percentage: 50, settlementCycle: '季度结算', notes: '词曲版权方' },
  { id: 'r2', sampleId: 's1', rightHolder: '星辰音乐工作室', percentage: 50, settlementCycle: '季度结算', notes: '制作方' },
  { id: 'r3', sampleId: 's2', rightHolder: '索尼音乐出版', percentage: 60, settlementCycle: '半年度结算', notes: '版权方' },
  { id: 'r4', sampleId: 's4', rightHolder: '百代音乐', percentage: 70, settlementCycle: '季度结算', notes: '版权方' },
  { id: 'r5', sampleId: 's5', rightHolder: '华纳音乐版权', percentage: 40, settlementCycle: '季度结算', notes: '词曲版权方' },
  { id: 'r6', sampleId: 's5', rightHolder: '星辰音乐工作室', percentage: 60, settlementCycle: '季度结算', notes: '制作方' },
]

const INITIAL_RELEASES: Release[] = [
  { id: 'rl1', title: '夜曲·新编', releaseDate: futureDate(30), sampleId: 's1', platformIds: ['p1', 'p2', 'p5'], status: 'validated', validationErrors: [] },
  { id: 'rl2', title: '光年·重溯', releaseDate: futureDate(45), sampleId: 's2', platformIds: ['p3', 'p4', 'p7'], status: 'draft', validationErrors: [] },
  { id: 'rl3', title: '泡沫·重构', releaseDate: futureDate(60), sampleId: 's3', platformIds: ['p1', 'p6'], status: 'blocked', validationErrors: ['contract_expired', 'royalty_missing'] },
  { id: 'rl4', title: '红豆·新声', releaseDate: futureDate(90), sampleId: 's4', platformIds: ['p1', 'p2'], status: 'draft', validationErrors: [] },
]

function computeContractStatus(endDate: string, startDate: string): ContractStatus {
  if (!startDate || !endDate) return 'pending'
  const now = new Date()
  const end = new Date(endDate)
  const diff = (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  if (diff < 0) return 'expired'
  if (diff <= 30) return 'expiring'
  return 'active'
}

function computePlatformStatus(endDate: string): PlatformStatus {
  const now = new Date()
  const end = new Date(endDate)
  if (end < now) return 'expired'
  return 'active'
}

function generateRisks(
  samples: Sample[],
  contracts: Contract[],
  platforms: Platform[],
  royalties: Royalty[],
  releases: Release[]
): RiskItem[] {
  const risks: RiskItem[] = []
  let rid = 0

  for (const c of contracts) {
    if (c.status === 'expired') {
      risks.push({
        id: `risk_${rid++}`,
        type: 'contract_expired',
        severity: 'high',
        message: `卡在合同续签：合同 ${c.contractNo} 已于 ${c.endDate} 到期，需续签后才能继续发行`,
        step: '合同续签',
        relatedId: c.id,
        relatedType: 'contract',
      })
    } else if (c.status === 'expiring') {
      const end = new Date(c.endDate)
      const diff = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      risks.push({
        id: `risk_${rid++}`,
        type: 'contract_expiring',
        severity: 'medium',
        message: `合同 ${c.contractNo} 将于 ${diff} 天后到期（${c.endDate}），建议尽快续签`,
        step: '合同续签',
        relatedId: c.id,
        relatedType: 'contract',
      })
    }
  }

  for (const s of samples) {
    const sampleRoyalties = royalties.filter(r => r.sampleId === s.id)
    if (sampleRoyalties.length === 0) {
      risks.push({
        id: `risk_${rid++}`,
        type: 'royalty_missing',
        severity: 'high',
        message: `卡在分成配置：采样「${s.title}」未配置分成规则，无法计算结算金额`,
        step: '分成配置',
        relatedId: s.id,
        relatedType: 'sample',
      })
    } else {
      const total = sampleRoyalties.reduce((sum, r) => sum + r.percentage, 0)
      if (total < 100) {
        risks.push({
          id: `risk_${rid++}`,
          type: 'royalty_insufficient',
          severity: 'medium',
          message: `卡在分成配置：采样「${s.title}」分成比例合计 ${total}%，剩余 ${100 - total}% 未分配`,
          step: '分成配置',
          relatedId: s.id,
          relatedType: 'sample',
        })
      }
    }
  }

  for (const rel of releases) {
    const sample = samples.find(s => s.id === rel.sampleId)
    if (!sample) continue
    const contract = contracts.find(c => c.id === sample.contractId)
    if (!contract) continue

    const authorizedPlatformIds = platforms
      .filter(p => p.contractId === contract.id && p.status === 'active')
      .map(p => p.id)

    const overstep = rel.platformIds.filter(pid => !authorizedPlatformIds.includes(pid))
    for (const pid of overstep) {
      const p = platforms.find(pl => pl.id === pid)
      if (p) {
        risks.push({
          id: `risk_${rid++}`,
          type: 'platform_overstep',
          severity: 'high',
          message: `卡在平台授权：${p.name} 未在合同 ${contract.contractNo} 授权范围内，需补充平台授权`,
          step: '平台授权',
          relatedId: rel.id,
          relatedType: 'release',
        })
      }
    }

    if (contract.status === 'expired' || contract.status === 'pending') {
      const relDate = new Date(rel.releaseDate)
      const cEnd = new Date(contract.endDate)
      if (contract.status === 'expired' || relDate > cEnd) {
        risks.push({
          id: `risk_${rid++}`,
          type: 'release_out_of_scope',
          severity: 'high',
          message: `卡在发行计划：发行日期 ${rel.releaseDate} 超出合同 ${contract.contractNo} 授权期限（至 ${contract.endDate}）`,
          step: '发行计划',
          relatedId: rel.id,
          relatedType: 'release',
        })
      }
    }
  }

  return risks
}

interface LedgerStore {
  samples: Sample[]
  contracts: Contract[]
  platforms: Platform[]
  royalties: Royalty[]
  releases: Release[]
  risks: RiskItem[]

  addSample: (s: Sample) => void
  updateSample: (id: string, s: Partial<Sample>) => void
  deleteSample: (id: string) => void

  addContract: (c: Contract) => void
  updateContract: (id: string, c: Partial<Contract>) => void
  deleteContract: (id: string) => void

  addPlatform: (p: Platform) => void
  updatePlatform: (id: string, p: Partial<Platform>) => void
  deletePlatform: (id: string) => void

  addRoyalty: (r: Royalty) => void
  updateRoyalty: (id: string, r: Partial<Royalty>) => void
  deleteRoyalty: (id: string) => void

  addRelease: (r: Release) => void
  updateRelease: (id: string, r: Partial<Release>) => void
  deleteRelease: (id: string) => void

  refreshRisks: () => void
  refreshContractStatuses: () => void
}

export const useLedgerStore = create<LedgerStore>()(
  persist(
    (set, get) => ({
      samples: INITIAL_SAMPLES,
      contracts: INITIAL_CONTRACTS,
      platforms: INITIAL_PLATFORMS,
      royalties: INITIAL_ROYALTIES,
      releases: INITIAL_RELEASES,
      risks: [],

      addSample: (s) => set(state => {
        const samples = [...state.samples, s]
        const risks = generateRisks(samples, state.contracts, state.platforms, state.royalties, state.releases)
        const sampleStatus: SampleStatus = s.contractId && s.royaltyIds.length > 0 ? 'complete' : s.royaltyIds.length === 0 ? 'at_risk' : 'incomplete'
        const newSample = { ...s, status: sampleStatus }
        const updated = samples.map(item => item.id === s.id ? newSample : item)
        return { samples: updated, risks }
      }),

      updateSample: (id, partial) => set(state => {
        const samples = state.samples.map(s => s.id === id ? { ...s, ...partial } : s)
        const updated = samples.map(s => {
          const contractId = s.contractId
          const royaltyIds = s.royaltyIds
          const status: SampleStatus = contractId && royaltyIds.length > 0 ? 'complete' : royaltyIds.length === 0 && contractId ? 'at_risk' : 'incomplete'
          return { ...s, status }
        })
        const risks = generateRisks(updated, state.contracts, state.platforms, state.royalties, state.releases)
        return { samples: updated, risks }
      }),

      deleteSample: (id) => set(state => {
        const samples = state.samples.filter(s => s.id !== id)
        const royalties = state.royalties.filter(r => r.sampleId !== id)
        const risks = generateRisks(samples, state.contracts, state.platforms, royalties, state.releases)
        return { samples, royalties, risks }
      }),

      addContract: (c) => set(state => {
        const contracts = [...state.contracts, c]
        const risks = generateRisks(state.samples, contracts, state.platforms, state.royalties, state.releases)
        return { contracts, risks }
      }),

      updateContract: (id, partial) => set(state => {
        const contracts = state.contracts.map(c => {
          const updated = { ...c, ...partial }
          if (partial.startDate || partial.endDate) {
            updated.status = computeContractStatus(updated.endDate, updated.startDate)
          }
          return updated
        })
        const platforms = state.platforms.map(p => {
          if (p.contractId === id) {
            const contract = contracts.find(c => c.id === id)
            if (contract) {
              p.status = contract.status === 'active' ? 'active' : 'expired'
            }
          }
          return { ...p }
        })
        const risks = generateRisks(state.samples, contracts, platforms, state.royalties, state.releases)
        return { contracts, platforms, risks }
      }),

      deleteContract: (id) => set(state => {
        const contracts = state.contracts.filter(c => c.id !== id)
        const risks = generateRisks(state.samples, contracts, state.platforms, state.royalties, state.releases)
        return { contracts, risks }
      }),

      addPlatform: (p) => set(state => {
        const platforms = [...state.platforms, p]
        const risks = generateRisks(state.samples, state.contracts, platforms, state.royalties, state.releases)
        return { platforms, risks }
      }),

      updatePlatform: (id, partial) => set(state => {
        const platforms = state.platforms.map(p => {
          const updated = { ...p, ...partial }
          if (partial.endDate) {
            updated.status = computePlatformStatus(updated.endDate)
          }
          return updated
        })
        const risks = generateRisks(state.samples, state.contracts, platforms, state.royalties, state.releases)
        return { platforms, risks }
      }),

      deletePlatform: (id) => set(state => {
        const platforms = state.platforms.filter(p => p.id !== id)
        const risks = generateRisks(state.samples, state.contracts, platforms, state.royalties, state.releases)
        return { platforms, risks }
      }),

      addRoyalty: (r) => set(state => {
        const royalties = [...state.royalties, r]
        const risks = generateRisks(state.samples, state.contracts, state.platforms, royalties, state.releases)
        return { royalties, risks }
      }),

      updateRoyalty: (id, partial) => set(state => {
        const royalties = state.royalties.map(r => ({ ...r, ...partial }))
        const risks = generateRisks(state.samples, state.contracts, state.platforms, royalties, state.releases)
        return { royalties, risks }
      }),

      deleteRoyalty: (id) => set(state => {
        const royalties = state.royalties.filter(r => r.id !== id)
        const risks = generateRisks(state.samples, state.contracts, state.platforms, royalties, state.releases)
        return { royalties, risks }
      }),

      addRelease: (r) => set(state => {
        const releases = [...state.releases, r]
        const risks = generateRisks(state.samples, state.contracts, state.platforms, state.royalties, releases)
        return { releases, risks }
      }),

      updateRelease: (id, partial) => set(state => {
        const releases = state.releases.map(r => ({ ...r, ...partial }))
        const risks = generateRisks(state.samples, state.contracts, state.platforms, state.royalties, releases)
        return { releases, risks }
      }),

      deleteRelease: (id) => set(state => {
        const releases = state.releases.filter(r => r.id !== id)
        const risks = generateRisks(state.samples, state.contracts, state.platforms, state.royalties, releases)
        return { releases, risks }
      }),

      refreshRisks: () => set(state => {
        const risks = generateRisks(state.samples, state.contracts, state.platforms, state.royalties, state.releases)
        return { risks }
      }),

      refreshContractStatuses: () => set(state => {
        const contracts = state.contracts.map(c => ({
          ...c,
          status: computeContractStatus(c.endDate, c.startDate),
        }))
        const platforms = state.platforms.map(p => ({
          ...p,
          status: computePlatformStatus(p.endDate),
        }))
        const risks = generateRisks(state.samples, contracts, platforms, state.royalties, state.releases)
        return { contracts, platforms, risks }
      }),
    }),
    {
      name: 'copyright-ledger-store',
    }
  )
)
