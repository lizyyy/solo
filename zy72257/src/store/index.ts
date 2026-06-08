import { createContext, useContext } from 'react'
import type {
  SafetyRadiusRow,
  CoordinateOriginNote,
  MergedObstacle,
  SelfCheckIssue,
  WorkflowStep,
  ExportPayload,
} from '../types'

export interface AppState {
  currentStep: WorkflowStep
  radiusRows: SafetyRadiusRow[]
  originNotes: CoordinateOriginNote[]
  mergedResults: MergedObstacle[]
  selfCheckIssues: SelfCheckIssue[]
  exportPayload: ExportPayload | null
  isMerged: boolean
}

export type AppAction =
  | { type: 'SET_STEP'; step: WorkflowStep }
  | { type: 'IMPORT_RADIUS_ROWS'; rows: SafetyRadiusRow[] }
  | { type: 'IMPORT_ORIGIN_NOTES'; notes: CoordinateOriginNote[] }
  | {
      type: 'MERGE_COMPLETE'
      merged: MergedObstacle[]
      issues: SelfCheckIssue[]
      payload: ExportPayload
    }
  | { type: 'SYNC_FROM_API'; data: { mergedResults: MergedObstacle[]; selfCheckIssues: SelfCheckIssue[]; exportPayload: ExportPayload } }
  | { type: 'CONFIRM_OBSTACLE'; obstacleId: string }
  | { type: 'RESOLVE_ISSUE'; issueId: string }
  | { type: 'RESET' }

export const initialState: AppState = {
  currentStep: 1,
  radiusRows: [],
  originNotes: [],
  mergedResults: [],
  selfCheckIssues: [],
  exportPayload: null,
  isMerged: false,
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, currentStep: action.step }

    case 'IMPORT_RADIUS_ROWS': {
      const existingIds = new Set(state.radiusRows.map(r => r.obstacleId))
      const duplicates = action.rows.filter(r => existingIds.has(r.obstacleId))
      const newRows = action.rows.filter(r => !existingIds.has(r.obstacleId))
      const updatedRows = duplicates.map(r => ({
        ...r,
        status: 'conflict' as const,
        manualChange: `重复导入(原行号${r.originalRowNumber})`,
      }))
      return {
        ...state,
        radiusRows: [...state.radiusRows, ...newRows, ...updatedRows],
      }
    }

    case 'IMPORT_ORIGIN_NOTES': {
      return {
        ...state,
        originNotes: [...state.originNotes, ...action.notes],
      }
    }

    case 'MERGE_COMPLETE':
      return {
        ...state,
        mergedResults: action.merged,
        selfCheckIssues: action.issues,
        exportPayload: action.payload,
        isMerged: true,
      }

    case 'SYNC_FROM_API':
      return {
        ...state,
        mergedResults: action.data.mergedResults,
        selfCheckIssues: action.data.selfCheckIssues,
        exportPayload: action.data.exportPayload,
        isMerged: true,
      }

    case 'CONFIRM_OBSTACLE': {
      const updated = state.mergedResults.map(m =>
        m.obstacleId === action.obstacleId
          ? { ...m, status: 'confirmed' as const, updatedAt: Date.now() }
          : m
      )
      return {
        ...state,
        mergedResults: updated,
        exportPayload: state.exportPayload
          ? rebuildExportPayload(updated, state.selfCheckIssues)
          : null,
      }
    }

    case 'RESOLVE_ISSUE': {
      const updatedIssues = state.selfCheckIssues.map(i =>
        i.id === action.issueId ? { ...i, resolved: true } : i
      )
      return {
        ...state,
        selfCheckIssues: updatedIssues,
      }
    }

    case 'RESET':
      return initialState

    default:
      return state
  }
}

function rebuildExportPayload(
  merged: MergedObstacle[],
  issues: SelfCheckIssue[]
): ExportPayload {
  const items = merged.map(item => ({
    obstacleId: item.obstacleId,
    displayName: item.namesFromRadiusTable[0] ?? item.namesFromOriginNote[0] ?? item.obstacleId,
    radius: item.radius,
    unit: item.unit,
    status: item.status,
    originalRowNumbers: item.originalRowNumbers,
    hasAnomaly: item.hasDuplicateName,
    anomalyDetail: item.duplicateNameDetail,
  }))

  const anomalies = items.filter(i => i.hasAnomaly).length
  const errors = issues.filter(i => i.severity === 'error').length
  const warnings = issues.filter(i => i.severity === 'warning').length

  return {
    generatedAt: Date.now(),
    totalObstacles: items.length,
    anomalies,
    items,
    selfCheckSummary: {
      totalChecks: issues.length,
      passed: issues.length - errors - warnings,
      warnings,
      errors,
    },
  }
}

export interface AppContextValue {
  state: AppState
  dispatch: React.Dispatch<AppAction>
}

export const AppContext = createContext<AppContextValue>({
  state: initialState,
  dispatch: () => {},
})

export function useAppState() {
  return useContext(AppContext)
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? `API ${path} 失败: ${res.status}`)
  }
  return res.json()
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) {
    throw new Error(`API ${path} 失败: ${res.status}`)
  }
  return res.json()
}
