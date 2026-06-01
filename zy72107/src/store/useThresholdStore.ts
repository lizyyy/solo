import { create } from "zustand"
import type { ThresholdVersion } from "@/types"

interface ThresholdStore {
  versions: ThresholdVersion[]
  currentVersion: number
  getCurrentThreshold: () => ThresholdVersion
  addVersion: (maxValue: number, changedBy: string, reason: string) => void
}

const INITIAL_THRESHOLD: ThresholdVersion = {
  version: 1,
  maxValue: 250,
  minValue: 0,
  unit: "°C",
  changedAt: "2024-03-01 08:00",
  changedBy: "系统默认",
  reason: "初始安全阈值",
}

export const useThresholdStore = create<ThresholdStore>((set, get) => ({
  versions: [INITIAL_THRESHOLD],
  currentVersion: 1,

  getCurrentThreshold: () => {
    const { versions, currentVersion } = get()
    return versions.find((v) => v.version === currentVersion) || versions[versions.length - 1]
  },

  addVersion: (maxValue, changedBy, reason) => {
    set((state) => {
      const newVersion: ThresholdVersion = {
        version: state.versions.length + 1,
        maxValue,
        minValue: 0,
        unit: "°C",
        changedAt: new Date().toLocaleString("zh-CN"),
        changedBy,
        reason,
      }
      return {
        versions: [...state.versions, newVersion],
        currentVersion: newVersion.version,
      }
    })
  },
}))
