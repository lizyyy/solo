import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Activity, ExplorerRecord, ActivityStatus, RecordResult, FailureReason, RecordSource } from '@/types'
import { generateId } from '@/utils'

interface ActivityStore {
  currentActivity: Activity | null
  records: ExplorerRecord[]
  activities: Activity[]
  activitiesRecords: Record<string, ExplorerRecord[]>
  startTimeEpoch: number | null
  pausedAccumulatedSeconds: number

  startActivity: () => void
  pauseActivity: () => void
  resumeActivity: () => void
  settleActivity: () => void
  restartActivity: () => void
  addRecord: (params: {
    polyhedronType: string
    score: number
    timeCostSeconds: number
    result: RecordResult
    failureReason: FailureReason | null
    failureDetail: string | null
    rawNote: string
  }) => void
  addSupplementRecord: (params: {
    polyhedronType: string
    score: number
    timeCostSeconds: number
    result: RecordResult
    failureReason: FailureReason | null
    failureDetail: string | null
    rawNote: string
    source: RecordSource
  }) => void
  updateRecordNote: (recordId: string, note: string) => void
  loadActivity: (activityId: string) => void
  clearAll: () => void
}

function createEmptyActivity(): Activity {
  return {
    id: generateId(),
    status: 'idle',
    createdAt: '',
    pausedAt: null,
    resumedAt: null,
    settledAt: null,
    totalElapsedSeconds: 0,
    pauseEvents: [],
  }
}

export const useActivityStore = create<ActivityStore>()(
  persist(
    (set, get) => ({
      currentActivity: null,
      records: [],
      activities: [],
      activitiesRecords: {},
      startTimeEpoch: null,
      pausedAccumulatedSeconds: 0,

      startActivity: () => {
        const now = new Date().toISOString()
        set({
          currentActivity: {
            id: generateId(),
            status: 'running',
            createdAt: now,
            pausedAt: null,
            resumedAt: null,
            settledAt: null,
            totalElapsedSeconds: 0,
            pauseEvents: [],
          },
          records: [],
          startTimeEpoch: Date.now(),
          pausedAccumulatedSeconds: 0,
        })
      },

      pauseActivity: () => {
        const { currentActivity, startTimeEpoch, pausedAccumulatedSeconds } = get()
        if (!currentActivity || currentActivity.status !== 'running' || !startTimeEpoch) return
        const now = new Date().toISOString()
        const elapsedBeforePause = Math.floor((Date.now() - startTimeEpoch) / 1000)
        set({
          currentActivity: {
            ...currentActivity,
            status: 'paused',
            pausedAt: now,
            pauseEvents: [...currentActivity.pauseEvents, { type: 'pause', timestamp: now }],
            totalElapsedSeconds: pausedAccumulatedSeconds + elapsedBeforePause,
          },
          pausedAccumulatedSeconds: pausedAccumulatedSeconds + elapsedBeforePause,
          startTimeEpoch: null,
        })
      },

      resumeActivity: () => {
        const { currentActivity } = get()
        if (!currentActivity || currentActivity.status !== 'paused') return
        const now = new Date().toISOString()
        set({
          currentActivity: {
            ...currentActivity,
            status: 'running',
            resumedAt: now,
            pauseEvents: [...currentActivity.pauseEvents, { type: 'resume', timestamp: now }],
          },
          startTimeEpoch: Date.now(),
        })
      },

      settleActivity: () => {
        const { currentActivity, records, startTimeEpoch, pausedAccumulatedSeconds } = get()
        if (!currentActivity) return
        const now = new Date().toISOString()
        let totalSeconds = currentActivity.totalElapsedSeconds
        if (startTimeEpoch && currentActivity.status === 'running') {
          totalSeconds = pausedAccumulatedSeconds + Math.floor((Date.now() - startTimeEpoch) / 1000)
        }
        const settled: Activity = {
          ...currentActivity,
          status: 'settled',
          settledAt: now,
          totalElapsedSeconds: totalSeconds,
        }
        set((state) => ({
          currentActivity: settled,
          activities: [...state.activities, settled],
          activitiesRecords: {
            ...state.activitiesRecords,
            [settled.id]: records,
          },
          startTimeEpoch: null,
        }))
      },

      restartActivity: () => {
        set({
          currentActivity: createEmptyActivity(),
          records: [],
          startTimeEpoch: null,
          pausedAccumulatedSeconds: 0,
        })
      },

      addRecord: (params) => {
        const { currentActivity, records } = get()
        if (!currentActivity || (currentActivity.status !== 'running' && currentActivity.status !== 'paused')) return
        const nextSeq = records.length > 0 ? records[records.length - 1].sequenceNumber + 1 : 1
        const newRecord: ExplorerRecord = {
          id: generateId(),
          activityId: currentActivity.id,
          sequenceNumber: nextSeq,
          source: 'realtime',
          processedAt: new Date().toISOString(),
          ...params,
        }
        set({
          records: [...records, newRecord],
        })
      },

      addSupplementRecord: (params) => {
        const { currentActivity, records } = get()
        if (!currentActivity) return
        const nextSeq = records.length > 0 ? records[records.length - 1].sequenceNumber + 1 : 1
        const newRecord: ExplorerRecord = {
          id: generateId(),
          activityId: currentActivity.id,
          sequenceNumber: nextSeq,
          processedAt: new Date().toISOString(),
          ...params,
        }
        set({
          records: [...records, newRecord],
          currentActivity: {
            ...currentActivity,
            totalElapsedSeconds: currentActivity.totalElapsedSeconds + params.timeCostSeconds,
          },
        })
      },

      updateRecordNote: (recordId: string, note: string) => {
        set((state) => ({
          records: state.records.map((r) =>
            r.id === recordId ? { ...r, rawNote: note } : r
          ),
        }))
      },

      loadActivity: (activityId: string) => {
        const { activities, activitiesRecords } = get()
        const activity = activities.find((a) => a.id === activityId)
        if (!activity) return
        const recs = activitiesRecords[activityId] || []
        set({
          currentActivity: activity,
          records: recs,
          startTimeEpoch: null,
          pausedAccumulatedSeconds: activity.totalElapsedSeconds,
        })
      },

      clearAll: () => {
        set({
          currentActivity: null,
          records: [],
          activities: [],
          activitiesRecords: {},
          startTimeEpoch: null,
          pausedAccumulatedSeconds: 0,
        })
      },
    }),
    {
      name: 'polyhedron-mine-storage',
      version: 1,
    }
  )
)
