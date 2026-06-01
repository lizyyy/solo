import { create } from "zustand"
import type { ExceptionItem } from "@/types"
import { calculateSummary } from "@/utils"
import { useRecordStore } from "./recordStore"

interface SummaryState {
  getSummary: () => {
    totalRecords: number
    passedRecords: number
    passRate: number
    avgDuration: number
    exceptionCount: number
    allExceptions: ExceptionItem[]
  }
  getExceptionsByType: () => Map<string, ExceptionItem[]>
  getStatsByLevelPack: () => Map<
    string,
    {
      name: string
      total: number
      passed: number
      passRate: number
    }
  >
}

export const useSummaryStore = create<SummaryState>()(() => ({
  getSummary: () => {
    const records = useRecordStore.getState().records
    return calculateSummary(records)
  },
  getExceptionsByType: () => {
    const { allExceptions } = useSummaryStore.getState().getSummary()
    const map = new Map<string, ExceptionItem[]>()
    allExceptions.forEach((e) => {
      const existing = map.get(e.type) ?? []
      map.set(e.type, [...existing, e])
    })
    return map
  },
  getStatsByLevelPack: () => {
    const records = useRecordStore.getState().records
    const map = new Map<
      string,
      {
        name: string
        total: number
        passed: number
        passRate: number
      }
    >()
    records.forEach((r) => {
      const existing = map.get(r.levelPackId) ?? {
        name: r.levelPackName,
        total: 0,
        passed: 0,
        passRate: 0,
      }
      existing.total += 1
      if (r.passed) existing.passed += 1
      existing.passRate = Math.round((existing.passed / existing.total) * 100)
      map.set(r.levelPackId, existing)
    })
    return map
  },
}))
