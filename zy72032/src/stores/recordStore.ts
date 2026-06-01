import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { TrainingRecord, SupplementRecord } from "@/types"
import { sampleRecords } from "@/data/sampleRecords"
import { generateId, determineFailureDiagnosis } from "@/utils"

interface RecordState {
  records: TrainingRecord[]
  addRecord: (record: Omit<TrainingRecord, "id" | "supplements">) => TrainingRecord
  getRecord: (id: string) => TrainingRecord | undefined
  addSupplement: (
    recordId: string,
    supplement: Omit<SupplementRecord, "id" | "timestamp" | "changedFields"> & {
      adjustScore?: { from: number; to: number }
    }
  ) => void
  setRecordPassed: (recordId: string, passed: boolean) => void
  clearAllRecords: () => void
  loadSampleRecords: () => void
}

export const useRecordStore = create<RecordState>()(
  persist(
    (set, get) => ({
      records: sampleRecords,
      addRecord: (record) => {
        const levelPack = useLevelStore.getState().getSelectedLevelPack()
        const failureDiagnosis = determineFailureDiagnosis(
          record.steps,
          record.totalScore,
          levelPack?.passingScore ?? 70
        )
        const newRecord: TrainingRecord = {
          ...record,
          id: generateId(),
          supplements: [],
          failureDiagnosis,
        }
        set((state) => ({
          records: [newRecord, ...state.records],
        }))
        return newRecord
      },
      getRecord: (id) => {
        return get().records.find((r) => r.id === id)
      },
      addSupplement: (
        recordId,
        supplement: Omit<SupplementRecord, "id" | "timestamp" | "changedFields"> & {
          adjustScore?: { from: number; to: number }
        }
      ) => {
        set((state) => ({
          records: state.records.map((r) => {
            if (r.id !== recordId) return r

            const changedFields: string[] = ["supplements"]
            if (supplement.adjustScore) {
              changedFields.push("totalScore", "passed", "failureDiagnosis")
            }

            const newSupplement: SupplementRecord = {
              content: supplement.content,
              source: supplement.source,
              id: generateId(),
              timestamp: Date.now(),
              previousScore: supplement.adjustScore?.from,
              newScore: supplement.adjustScore?.to,
              changedFields,
            }

            const updates: Partial<TrainingRecord> = {
              supplements: [...r.supplements, newSupplement],
            }

            if (supplement.adjustScore) {
              updates.totalScore = supplement.adjustScore.to
              const levelPack = useLevelStore
                .getState()
                .levelPacks.find((p) => p.id === r.levelPackId)
              updates.passed =
                supplement.adjustScore.to >= (levelPack?.passingScore ?? 70)
              updates.failureDiagnosis = determineFailureDiagnosis(
                r.steps,
                supplement.adjustScore.to,
                levelPack?.passingScore ?? 70
              )
            }

            return { ...r, ...updates }
          }),
        }))
      },
      setRecordPassed: (recordId, passed) => {
        set((state) => ({
          records: state.records.map((r) =>
            r.id === recordId
              ? { ...r, passed, needsManualReview: false }
              : r
          ),
        }))
      },
      clearAllRecords: () => set({ records: [] }),
      loadSampleRecords: () => set({ records: sampleRecords }),
    }),
    {
      name: "ai-camp-record-store",
    }
  )
)

import { useLevelStore } from "./levelStore"
