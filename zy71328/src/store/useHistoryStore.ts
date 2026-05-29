import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { HistoryRecord, ProcessReport, ProcessConfig } from '../types'

interface HistoryState {
  historyRecords: HistoryRecord[]
  reports: ProcessReport[]
  addHistoryRecord: (audioFileId: string, config: ProcessConfig, description: string) => void
  addReport: (
    audioFileId: string,
    originalLufs: number,
    processedLufs: number,
    originalTruePeak: number,
    processedTruePeak: number,
    duration: number,
    config: ProcessConfig,
    peakMarksCount: number,
    fixedPeaksCount: number,
    processingTime: number
  ) => void
  rollbackToVersion: (recordId: string) => ProcessConfig | null
  setHistoryRecords: (records: HistoryRecord[]) => void
  setReports: (reports: ProcessReport[]) => void
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set, get) => ({
      historyRecords: [],
      reports: [],
      addHistoryRecord: (audioFileId, config, description) =>
        set((state) => ({
          historyRecords: [
            ...state.historyRecords,
            {
              id: crypto.randomUUID(),
              audioFileId,
              timestamp: Date.now(),
              config: { ...config },
              description,
            },
          ],
        })),
      addReport: (
        audioFileId,
        originalLufs,
        processedLufs,
        originalTruePeak,
        processedTruePeak,
        duration,
        config,
        peakMarksCount,
        fixedPeaksCount,
        processingTime
      ) =>
        set((state) => ({
          reports: [
            ...state.reports,
            {
              id: crypto.randomUUID(),
              audioFileId,
              timestamp: Date.now(),
              originalLufs,
              processedLufs,
              originalTruePeak,
              processedTruePeak,
              duration,
              config: { ...config },
              peakMarksCount,
              fixedPeaksCount,
              processingTime,
            },
          ],
        })),
      rollbackToVersion: (recordId) => {
        const record = get().historyRecords.find((r) => r.id === recordId)
        return record ? { ...record.config } : null
      },
      setHistoryRecords: (records) => set({ historyRecords: records }),
      setReports: (reports) => set({ reports }),
    }),
    {
      name: 'podcast-history-v1',
    }
  )
)
