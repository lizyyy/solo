import { create } from "zustand"
import type { Sample, ReviewRecord, ReplayResult, MetricsResult } from "@/types"
import { INITIAL_SAMPLES } from "@/data/initialSamples"
import { mockReplay } from "@/utils/replay"

interface AppState {
  samples: Sample[]
  replayResults: ReplayResult[]
  reviewRecords: ReviewRecord[]

  runReplay: (sampleId: string) => void
  runAllReplays: () => void
  confirmModel: (sampleId: string) => void
  correctLabel: (sampleId: string, correctedLabel: string, reason: string, reviewer: string) => void
  markNeedsReview: (sampleId: string) => void
  addSample: (sample: Omit<Sample, "id">) => void
  computeMetrics: () => MetricsResult
  resetData: () => void
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
}

export const useStore = create<AppState>((set, get) => ({
  samples: [...INITIAL_SAMPLES],
  replayResults: [],
  reviewRecords: [],

  runReplay: (sampleId: string) => {
    const sample = get().samples.find((s) => s.id === sampleId)
    if (!sample) return

    const result = mockReplay(sample)

    set((state) => ({
      replayResults: [
        ...state.replayResults.filter((r) => r.sampleId !== sampleId),
        result,
      ],
      samples: state.samples.map((s) =>
        s.id === sampleId
          ? { ...s, modelLabel: result.modelLabel }
          : s
      ),
    }))
  },

  runAllReplays: () => {
    const { samples } = get()
    const nonDuplicate = samples.filter((s) => !s.isDuplicate || s.hasConflict)

    const results: ReplayResult[] = []
    const updatedSamples = samples.map((sample) => {
      if (!nonDuplicate.find((s) => s.id === sample.id)) return sample
      const result = mockReplay(sample)
      results.push(result)
      return { ...sample, modelLabel: result.modelLabel }
    })

    set((state) => ({
      replayResults: [
        ...state.replayResults.filter((r) => !nonDuplicate.find((s) => s.id === r.sampleId)),
        ...results,
      ],
      samples: updatedSamples,
    }))
  },

  confirmModel: (sampleId: string) => {
    set((state) => ({
      samples: state.samples.map((s) =>
        s.id === sampleId
          ? {
              ...s,
              status: "model_judged" as const,
              finalLabel: s.modelLabel,
              processedAt: new Date().toISOString(),
            }
          : s
      ),
    }))
  },

  correctLabel: (sampleId: string, correctedLabel: string, reason: string, reviewer: string) => {
    const sample = get().samples.find((s) => s.id === sampleId)
    if (!sample) return

    const previousLabel = sample.modelLabel ?? sample.originalLabel
    const record: ReviewRecord = {
      id: generateId("REV"),
      sampleId,
      previousLabel,
      correctedLabel,
      correctionReason: reason,
      reviewer,
      reviewedAt: new Date().toISOString(),
    }

    set((state) => ({
      reviewRecords: [...state.reviewRecords, record],
      samples: state.samples.map((s) =>
        s.id === sampleId
          ? {
              ...s,
              status: "human_corrected" as const,
              finalLabel: correctedLabel,
              processedAt: new Date().toISOString(),
            }
          : s
      ),
    }))
  },

  markNeedsReview: (sampleId: string) => {
    set((state) => ({
      samples: state.samples.map((s) =>
        s.id === sampleId
          ? { ...s, status: "needs_review" as const, processedAt: null }
          : s
      ),
    }))
  },

  addSample: (sampleData: Omit<Sample, "id">) => {
    const newSample: Sample = {
      ...sampleData,
      id: generateId("SMP"),
    }
    set((state) => ({ samples: [...state.samples, newSample] }))
  },

  computeMetrics: () => {
    const { samples, replayResults } = get()
    const nonDuplicate = samples.filter((s) => !s.isDuplicate)
    const totalSamples = nonDuplicate.length

    const modelJudgedCount = nonDuplicate.filter((s) => s.status === "model_judged").length
    const humanCorrectedCount = nonDuplicate.filter((s) => s.status === "human_corrected").length
    const needsReviewCount = nonDuplicate.filter((s) => s.status === "needs_review").length

    const conflictCount = samples.filter((s) => s.hasConflict).length
    const leakageCount = samples.filter((s) => s.hasLeakage).length
    const duplicateCount = samples.filter((s) => s.isDuplicate).length
    const missingCitationCount = replayResults.filter((r) => r.citation === null).length

    return {
      totalSamples,
      modelJudgedCount,
      humanCorrectedCount,
      needsReviewCount,
      modelJudgedRate: totalSamples > 0 ? modelJudgedCount / totalSamples : 0,
      humanCorrectedRate: totalSamples > 0 ? humanCorrectedCount / totalSamples : 0,
      needsReviewRate: totalSamples > 0 ? needsReviewCount / totalSamples : 0,
      conflictCount,
      leakageCount,
      duplicateCount,
      missingCitationCount,
    }
  },

  resetData: () => {
    set({
      samples: [...INITIAL_SAMPLES],
      replayResults: [],
      reviewRecords: [],
    })
  },
}))
