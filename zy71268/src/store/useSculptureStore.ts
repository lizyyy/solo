import { create } from 'zustand'
import { Sculpture, mockSculptures } from '@/data/mockSculptures'

interface RiskItem {
  type: 'cog_exceed' | 'base_undersize' | 'wind_misalign'
  severity: 'danger' | 'warning' | 'caution'
  title: string
  description: string
}

function computeRisks(s: Sculpture): RiskItem[] {
  const risks: RiskItem[] = []

  const cogOffset = Math.sqrt(
    s.centerOfGravity.x ** 2 + s.centerOfGravity.z ** 2
  )
  if (cogOffset > s.cogLimit.radius) {
    risks.push({
      type: 'cog_exceed',
      severity: 'danger',
      title: '重心越界',
      description: `重心偏移 ${cogOffset.toFixed(2)}m，超出允许范围 ${s.cogLimit.radius.toFixed(2)}m。雕塑可能向偏移方向倾倒，建议调整内部配重或修改结构使重心回归中心区域。`,
    })
  } else if (cogOffset > s.cogLimit.radius * 0.8) {
    risks.push({
      type: 'cog_exceed',
      severity: 'caution',
      title: '重心接近限值',
      description: `重心偏移 ${cogOffset.toFixed(2)}m，已接近允许范围 ${s.cogLimit.radius.toFixed(2)}m 的80%。虽然目前仍在安全范围内，但余量不多，建议关注。`,
    })
  }

  if (
    s.base.width < s.baseMinRequired.width ||
    s.base.depth < s.baseMinRequired.depth
  ) {
    const shortW = s.base.width < s.baseMinRequired.width
    const shortD = s.base.depth < s.baseMinRequired.depth
    risks.push({
      type: 'base_undersize',
      severity: 'danger',
      title: '底座过小',
      description: `底座尺寸 ${s.base.width}×${s.base.depth}m，${shortW ? `宽度不足（需 ≥${s.baseMinRequired.width}m）` : ''}${shortW && shortD ? '，' : ''}${shortD ? `深度不足（需 ≥${s.baseMinRequired.depth}m）` : ''}。底座面积不足会导致接地压强过大，存在倾覆风险，建议加大底座或增设锚固。`,
    })
  } else if (
    s.base.width < s.baseMinRequired.width * 1.1 ||
    s.base.depth < s.baseMinRequired.depth * 1.1
  ) {
    risks.push({
      type: 'base_undersize',
      severity: 'warning',
      title: '底座余量不足',
      description: `底座尺寸 ${s.base.width}×${s.base.depth}m，仅勉强满足最低要求（${s.baseMinRequired.width}×${s.baseMinRequired.depth}m）。建议预留至少10%余量以应对施工偏差。`,
    })
  }

  const actualAngle = Math.atan2(s.windLoad.direction.z, s.windLoad.direction.x)
  const designAngle = Math.atan2(
    s.windLoad.designDirection.z,
    s.windLoad.designDirection.x
  )
  let angleDiff = Math.abs(actualAngle - designAngle)
  if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff
  const angleDiffDeg = (angleDiff * 180) / Math.PI
  if (angleDiffDeg > 30) {
    risks.push({
      type: 'wind_misalign',
      severity: 'warning',
      title: '风载方向偏差大',
      description: `实际主风向与设计风向偏差 ${angleDiffDeg.toFixed(1)}°，超过30°阈值。当前设计可能低估了侧向风力，建议按实际风向重新验算风载并补充侧向锚固。`,
    })
  } else if (angleDiffDeg > 15) {
    risks.push({
      type: 'wind_misalign',
      severity: 'caution',
      title: '风载方向有偏差',
      description: `实际主风向与设计风向偏差 ${angleDiffDeg.toFixed(1)}°。偏差在可接受范围内，但建议现场确认风向数据是否准确。`,
    })
  }

  return risks
}

interface SculptureStore {
  sculptures: Sculpture[]
  selectedId: string | null
  versionIndex: number
  compareMode: boolean
  compareVersionIndex: number
  panelCollapsed: boolean

  filteredLocation: string
  filteredStatus: string

  risks: RiskItem[]

  selectedSculpture: () => Sculpture | null
  selectSculpture: (id: string) => void
  setVersionIndex: (idx: number) => void
  setCompareMode: (on: boolean) => void
  setCompareVersionIndex: (idx: number) => void
  togglePanel: () => void
  setFilteredLocation: (loc: string) => void
  setFilteredStatus: (status: string) => void
  updateCOG: (id: string, cog: { x: number; y: number; z: number }) => void
  updateManualCheck: (
    id: string,
    check: { notes: string; checkedBy: string; checkedAt: string }
  ) => void
  filteredSculptures: () => Sculpture[]
}

export type { RiskItem }

export const useSculptureStore = create<SculptureStore>((set, get) => ({
  sculptures: mockSculptures,
  selectedId: mockSculptures[0].id,
  versionIndex: 0,
  compareMode: false,
  compareVersionIndex: 1,
  panelCollapsed: false,
  filteredLocation: '',
  filteredStatus: '',
  risks: computeRisks(mockSculptures[0]),

  selectedSculpture: () => {
    const state = get()
    return state.sculptures.find((s) => s.id === state.selectedId) ?? null
  },

  selectSculpture: (id) => {
    const s = get().sculptures.find((sc) => sc.id === id)
    set({
      selectedId: id,
      versionIndex: 0,
      risks: s ? computeRisks(s) : [],
    })
  },

  setVersionIndex: (idx) => {
    const state = get()
    const s = state.sculptures.find((sc) => sc.id === state.selectedId)
    if (s && s.versions[idx]) {
      const v = s.versions[idx]
      const updated = state.sculptures.map((sc) =>
        sc.id === s.id
          ? {
              ...sc,
              centerOfGravity: v.cog,
              base: { ...sc.base, width: v.baseW, depth: v.baseD },
            }
          : sc
      )
      const updatedS = updated.find((sc) => sc.id === s.id)!
      set({
        versionIndex: idx,
        sculptures: updated,
        risks: computeRisks(updatedS),
      })
    }
  },

  setCompareMode: (on) => set({ compareMode: on }),
  setCompareVersionIndex: (idx) => set({ compareVersionIndex: idx }),
  togglePanel: () => set((s) => ({ panelCollapsed: !s.panelCollapsed })),

  setFilteredLocation: (loc) => set({ filteredLocation: loc }),
  setFilteredStatus: (status) => set({ filteredStatus: status }),

  updateCOG: (id, cog) => {
    const state = get()
    const updated = state.sculptures.map((sc) =>
      sc.id === id ? { ...sc, centerOfGravity: cog } : sc
    )
    const s = updated.find((sc) => sc.id === id)
    set({
      sculptures: updated,
      risks: s ? computeRisks(s) : [],
    })
  },

  updateManualCheck: (id, check) => {
    set((state) => ({
      sculptures: state.sculptures.map((sc) =>
        sc.id === id ? { ...sc, manualCheck: check } : sc
      ),
    }))
  },

  filteredSculptures: () => {
    const state = get()
    return state.sculptures.filter((s) => {
      if (state.filteredLocation && s.installLocation !== state.filteredLocation)
        return false
      if (
        state.filteredStatus &&
        s.reviewReport.status !== state.filteredStatus
      )
        return false
      return true
    })
  },
}))
