import { create } from 'zustand'
import type { AppData, Batch, Observation, PosteriorResult, SupplementDiff, PriorParams, BoundaryConfig } from '@/utils/types'
import { bayesianUpdate, checkUnits, checkWeights, checkBoundaries, detectOutliers, supplementNote, DEFAULT_BOUNDARY } from '@/utils/bayesian'

const STORAGE_KEY = 'bayesian_ad_tool'

function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return getDefaultData()
}

function saveData(data: AppData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

function getDefaultData(): AppData {
  return {
    batches: [SAMPLE_BATCH],
    computations: [],
    supplements: [],
    priorParams: { type: 'beta', alpha: 1, beta: 1 },
    boundaryConfig: { ...DEFAULT_BOUNDARY },
  }
}

const SAMPLE_BATCH: Batch = {
  batchId: 'sample-001',
  createdAt: new Date().toLocaleString('zh-CN'),
  operatorName: '调度主管周姐',
  note: '第一包测试材料',
  observations: [
    {
      obsId: 'obs-001',
      channel: '抖音信息流',
      impressions: 150000,
      clicks: 4500,
      conversions: 135,
      unit: 'CPM',
      weight: 0.35,
      source: '抖音后台导出 6/1',
      recordedAt: new Date().toLocaleString('zh-CN'),
      note: '这个渠道转化率稳定，没什么问题',
      isOutlier: false,
      outlierReason: '',
    },
    {
      obsId: 'obs-002',
      channel: '微信朋友圈',
      impressions: 80000,
      clicks: 2400,
      conversions: 72,
      unit: 'CPM',
      weight: 0.25,
      source: '微信广告平台 6/1',
      recordedAt: new Date().toLocaleString('zh-CN'),
      note: '朋友圈素材A/B测试中 B组表现好 但数据还没拆开',
      isOutlier: false,
      outlierReason: '',
    },
    {
      obsId: 'obs-003',
      channel: '百度搜索',
      impressions: 50000,
      clicks: 3000,
      conversions: 60,
      unit: 'CPC',
      weight: 0.20,
      source: '百度SEM后台 5/31 晚导出',
      recordedAt: new Date().toLocaleString('zh-CN'),
      note: '单位是CPC不是CPM!!别搞混了',
      isOutlier: false,
      outlierReason: '',
    },
    {
      obsId: 'obs-004',
      channel: '快手短视频',
      impressions: 200000,
      clicks: 8000,
      conversions: 800,
      unit: 'CPM',
      weight: 0.15,
      source: '快手磁力引擎 6/1',
      recordedAt: new Date().toLocaleString('zh-CN'),
      note: '转化率4% 明显偏高？？？可能是归因窗口设置不同 先标记',
      isOutlier: true,
      outlierReason: '转化率4%超出同组3倍标准差，疑似归因口径不同',
    },
    {
      obsId: 'obs-005',
      channel: '小红书种草',
      impressions: 30000,
      clicks: 600,
      conversions: 6,
      unit: 'CPA',
      weight: 0.10,
      source: '小红书效果广告 6/1',
      recordedAt: new Date().toLocaleString('zh-CN'),
      note: 'cpa计费 单位不一样 注意换算~~',
      isOutlier: false,
      outlierReason: '',
    },
  ],
}

interface AppStore extends AppData {
  setPriorParams: (params: PriorParams) => void
  setBoundaryConfig: (config: BoundaryConfig) => void
  addBatch: (batch: Batch) => void
  addObservation: (batchId: string, obs: Observation) => void
  updateObservation: (batchId: string, obsId: string, updates: Partial<Observation>) => void
  removeObservation: (batchId: string, obsId: string) => void
  runComputation: (batchId: string) => PosteriorResult | null
  runSupplement: (computeId: string, newObs: Observation, operatorName: string) => SupplementDiff | null
  deleteComputation: (computeId: string) => void
  exportData: () => string
  importData: (json: string) => boolean
  resetData: () => void
}

export const useStore = create<AppStore>((set, get) => ({
  ...loadData(),

  setPriorParams: (params) => {
    set({ priorParams: params })
    saveData({ ...get(), priorParams: params })
  },

  setBoundaryConfig: (config) => {
    set({ boundaryConfig: config })
    saveData({ ...get(), boundaryConfig: config })
  },

  addBatch: (batch) => {
    const batches = [...get().batches, batch]
    set({ batches })
    saveData({ ...get(), batches })
  },

  addObservation: (batchId, obs) => {
    const batches = get().batches.map(b =>
      b.batchId === batchId ? { ...b, observations: [...b.observations, obs] } : b
    )
    set({ batches })
    saveData({ ...get(), batches })
  },

  updateObservation: (batchId, obsId, updates) => {
    const batches = get().batches.map(b =>
      b.batchId === batchId
        ? {
            ...b,
            observations: b.observations.map(o =>
              o.obsId === obsId ? { ...o, ...updates } : o
            ),
          }
        : b
    )
    set({ batches })
    saveData({ ...get(), batches })
  },

  removeObservation: (batchId, obsId) => {
    const batches = get().batches.map(b =>
      b.batchId === batchId
        ? { ...b, observations: b.observations.filter(o => o.obsId !== obsId) }
        : b
    )
    set({ batches })
    saveData({ ...get(), batches })
  },

  runComputation: (batchId) => {
    const state = get()
    const batch = state.batches.find(b => b.batchId === batchId)
    if (!batch) return null

    const allObs = state.batches.flatMap(b => b.observations)
    const unitWarnings = checkUnits(allObs)
    const weightWarnings = checkWeights(batch.observations)
    const boundaryWarnings = checkBoundaries(batch.observations, state.boundaryConfig)

    const outliers = detectOutliers(batch.observations, state.boundaryConfig.outlierStdThreshold)
    const outlierWarnings: typeof unitWarnings = outliers.map(o => ({
      type: 'outlier_detected' as const,
      field: `conversions(${o.channel})`,
      message: `渠道「${o.channel}」疑似越界样本`,
      detail: `该渠道数据偏离组均值超过${state.boundaryConfig.outlierStdThreshold}倍标准差。原始备注：${o.note}`,
      severity: 'warn' as const,
    }))

    const result = bayesianUpdate(
      state.priorParams,
      batch.observations,
      state.boundaryConfig,
      batchId
    )

    result.warnings = [...unitWarnings, ...weightWarnings, ...boundaryWarnings, ...outlierWarnings, ...result.warnings]

    const computations = [...state.computations, result]
    set({ computations })
    saveData({ ...get(), computations })
    return result
  },

  runSupplement: (computeId, newObs, operatorName) => {
    const state = get()
    const prevResult = state.computations.find(c => c.computeId === computeId)
    if (!prevResult) return null

    const diff = supplementNote(prevResult, newObs, state.priorParams, state.boundaryConfig, operatorName)

    const supplements = [...state.supplements, diff]
    const computations = state.computations.map(c =>
      c.computeId === computeId ? diff.after : c
    )
    
    const batches = state.batches.map(b =>
      b.batchId === prevResult.batchId
        ? { ...b, observations: [...b.observations, newObs] }
        : b
    )
    
    set({ supplements, computations, batches })
    saveData({ ...get(), supplements, computations, batches })
    return diff
  },

  deleteComputation: (computeId) => {
    const computations = get().computations.filter(c => c.computeId !== computeId)
    set({ computations })
    saveData({ ...get(), computations })
  },

  exportData: () => {
    const data = get()
    const exportObj = {
      batches: data.batches,
      computations: data.computations,
      supplements: data.supplements,
      priorParams: data.priorParams,
      boundaryConfig: data.boundaryConfig,
      exportedAt: new Date().toLocaleString('zh-CN'),
    }
    return JSON.stringify(exportObj, null, 2)
  },

  importData: (json) => {
    try {
      const data = JSON.parse(json)
      if (data.batches && data.priorParams) {
        set({
          batches: data.batches,
          computations: data.computations || [],
          supplements: data.supplements || [],
          priorParams: data.priorParams,
          boundaryConfig: data.boundaryConfig || { ...DEFAULT_BOUNDARY },
        })
        saveData({ ...get(), ...data })
        return true
      }
    } catch { /* ignore */ }
    return false
  },

  resetData: () => {
    const defaults = getDefaultData()
    set(defaults)
    saveData(defaults)
  },
}))
