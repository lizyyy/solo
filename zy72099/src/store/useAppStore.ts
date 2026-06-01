import { create } from 'zustand'
import type { ExhibitPoint, ValidationResult, OptimizationResult, Supplement, Conflict } from '@/types'
import { validatePoints } from '@/utils/validation'
import { optimizeRoute } from '@/utils/optimization'

interface AppState {
  points: ExhibitPoint[]
  validationResults: ValidationResult[]
  optimizationResult: OptimizationResult | null
  supplements: Supplement[]
  conflicts: Conflict[]
  highlightedPointId: string | null
  isOptimizing: boolean

  loadPoints: (points: ExhibitPoint[]) => void
  runValidation: () => void
  runOptimization: () => void
  addSupplement: (supplement: Omit<Supplement, 'id' | 'timestamp'>) => void
  detectConflicts: () => void
  setHighlightedPoint: (id: string | null) => void
  getPointById: (id: string) => ExhibitPoint | undefined
  clearAll: () => void
}

export const useAppStore = create<AppState>((set, get) => ({
  points: [],
  validationResults: [],
  optimizationResult: null,
  supplements: [],
  conflicts: [],
  highlightedPointId: null,
  isOptimizing: false,

  loadPoints: (points) => {
    set({ points, optimizationResult: null, supplements: [], conflicts: [] })
    get().runValidation()
  },

  runValidation: () => {
    const { points } = get()
    const results = validatePoints(points)
    set({ validationResults: results })
  },

  runOptimization: () => {
    set({ isOptimizing: true })
    const { points } = get()
    setTimeout(() => {
      const result = optimizeRoute(points)
      set({ optimizationResult: result, isOptimizing: false })
      get().detectConflicts()
    }, 600)
  },

  addSupplement: (supplement) => {
    const newSupplement: Supplement = {
      ...supplement,
      id: `S${Date.now()}`,
      timestamp: new Date().toLocaleString('zh-CN'),
    }
    const { points, supplements } = get()
    const updatedPoints = points.map((p) => {
      if (p.id === supplement.pointId) {
        return { ...p, [supplement.field]: supplement.newValue }
      }
      return p
    })
    set({ points: updatedPoints, supplements: [...supplements, newSupplement] })
    get().runValidation()
    if (get().optimizationResult) {
      const result = optimizeRoute(updatedPoints)
      set({ optimizationResult: result })
      get().detectConflicts()
    }
  },

  detectConflicts: () => {
    const { points, optimizationResult } = get()
    if (!optimizationResult) return
    const conflicts: Conflict[] = []

    const suspiciousPoint = points.find(
      (p) => p.estimatedStayMinutes !== null && p.estimatedStayMinutes > 120,
    )
    if (suspiciousPoint && optimizationResult.estimatedTime > 180) {
      conflicts.push({
        id: `C${Date.now()}_1`,
        summaryClaim: `汇总页显示预计总时间 ${optimizationResult.estimatedTime} 分钟（${(optimizationResult.estimatedTime / 60).toFixed(1)} 小时）`,
        dataEvidence: `展点"${suspiciousPoint.name}"停留时间 ${suspiciousPoint.estimatedStayMinutes} 分钟，占总量 ${(suspiciousPoint.estimatedStayMinutes! / optimizationResult.estimatedTime * 100).toFixed(0)}%，疑似异常值`,
        suggestedAction: '建议复核该展点停留时间后再看汇总数据，或先将其排除后重新计算',
      })
    }

    const ftPoints = points.filter((p) => p.unit === 'ft')
    if (ftPoints.length > 0) {
      conflicts.push({
        id: `C${Date.now()}_2`,
        summaryClaim: `汇总页距离单位为"米"，总距离 ${optimizationResult.totalDistance}m`,
        dataEvidence: `原始数据中"${ftPoints.map((p) => p.name).join('、')}"使用英尺单位，已自动转换（1ft=0.3048m），但原始坐标可能与实际物理布局有偏差`,
        suggestedAction: '建议统一原始数据单位后重新导入，或确认英尺坐标是否为实地测量值',
      })
    }

    set({ conflicts })
  },

  setHighlightedPoint: (id) => set({ highlightedPointId: id }),

  getPointById: (id) => {
    return get().points.find((p) => p.id === id)
  },

  clearAll: () =>
    set({
      points: [],
      validationResults: [],
      optimizationResult: null,
      supplements: [],
      conflicts: [],
      highlightedPointId: null,
      isOptimizing: false,
    }),
}))
