import { create } from "zustand"
import type {
  CounterExample,
  QuestionnaireRow,
  RunRecord,
  ConflictEvidence,
  SelfCheckResult,
  ConflictResolution,
  Toast,
  ToastType,
  GradientConfig,
  RunSummary,
  MaterialSource,
} from "@/types"
import { loadFromStorage, saveToStorage, clearAllStorage } from "@/utils/storage"
import { determineStatus, generateConflictEvidences } from "@/utils/comparator"
import { runSelfChecks } from "@/utils/selfCheck"
import { generateReport } from "@/utils/report"
import { normalMaterials, mismatchMaterials, supplementaryMaterials, createSampleQuestionnaireRows } from "@/utils/sampleData"

interface AppState {
  counterExamples: CounterExample[]
  questionnaireRows: QuestionnaireRow[]
  runRecords: RunRecord[]
  conflictEvidences: ConflictEvidence[]
  selfCheckResults: SelfCheckResult[]
  toasts: Toast[]
  gradientConfig: GradientConfig

  importCounterExamples: (items: CounterExample[], source: MaterialSource) => void
  importQuestionnaireRows: (rows: QuestionnaireRow[]) => void
  resolveConflict: (ceId: string, resolution: "confirmed" | "rejected") => void
  runMaterial: (mode: MaterialSource) => void
  runSelfChecksNow: () => void
  clearAllData: () => void
  addToast: (type: ToastType, message: string) => void
  removeToast: (id: string) => void
  setGradientConfig: (config: Partial<GradientConfig>) => void
  exportReport: () => string
  loadSampleData: () => void
}

const defaultGradientConfig: GradientConfig = {
  learningRate: 0.1,
  startX: -2,
  startY: -2,
  maxSteps: 100,
  funcType: "quadratic",
}

const useAppStore = create<AppState>()((set, get) => ({
  counterExamples: loadFromStorage<CounterExample[]>("counter_examples", []),
  questionnaireRows: loadFromStorage<QuestionnaireRow[]>("questionnaire_rows", []),
  runRecords: loadFromStorage<RunRecord[]>("run_records", []),
  conflictEvidences: loadFromStorage<ConflictEvidence[]>("conflict_evidences", []),
  selfCheckResults: loadFromStorage<SelfCheckResult[]>("self_check_results", []),
  toasts: [],
  gradientConfig: loadFromStorage<GradientConfig>("gradient_config", defaultGradientConfig),

  importCounterExamples: (items, source) => {
    set((state) => {
      const processed = items.map((item) => {
        const status = determineStatus(item.originalValue, item.threshold)
        return {
          ...item,
          source,
          status: status === "boundary" ? ("pending_review" as const) : status,
        }
      })
      const newCounterExamples = [...state.counterExamples, ...processed]
      const newConflictEvidences = generateConflictEvidences(newCounterExamples, state.questionnaireRows)
      saveToStorage("counter_examples", newCounterExamples)
      saveToStorage("conflict_evidences", newConflictEvidences)
      return {
        counterExamples: newCounterExamples,
        conflictEvidences: newConflictEvidences,
      }
    })
  },

  importQuestionnaireRows: (rows) => {
    set((state) => {
      const newRows = [...state.questionnaireRows, ...rows]
      const newConflictEvidences = generateConflictEvidences(state.counterExamples, newRows)
      saveToStorage("questionnaire_rows", newRows)
      saveToStorage("conflict_evidences", newConflictEvidences)
      return {
        questionnaireRows: newRows,
        conflictEvidences: newConflictEvidences,
      }
    })
  },

  resolveConflict: (ceId, resolution) => {
    set((state) => {
      const newCounterExamples = state.counterExamples.map((ce) =>
        ce.id === ceId
          ? {
              ...ce,
              conflictResolution: resolution as ConflictResolution,
              status: resolution === "confirmed" ? ("conflict" as const) : ("normal" as const),
            }
          : ce
      )
      saveToStorage("counter_examples", newCounterExamples)
      return { counterExamples: newCounterExamples }
    })
  },

  runMaterial: (mode) => {
    set((state) => {
      const materialCEs = state.counterExamples.filter((ce) => ce.source === mode)
      const summary: RunSummary = {
        totalCounterExamples: materialCEs.length,
        normalCount: materialCEs.filter((ce) => ce.status === "normal").length,
        boundaryCount: materialCEs.filter((ce) => ce.status === "boundary").length,
        conflictCount: materialCEs.filter((ce) => ce.status === "conflict").length,
        pendingReviewCount: materialCEs.filter((ce) => ce.status === "pending_review").length,
      }
      const record: RunRecord = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        mode,
        counterExampleIds: materialCEs.map((ce) => ce.id),
        summary,
      }
      const newRunRecords = [...state.runRecords, record]
      saveToStorage("run_records", newRunRecords)
      return { runRecords: newRunRecords }
    })
  },

  runSelfChecksNow: () => {
    const { counterExamples, runRecords } = get()
    const results = runSelfChecks(counterExamples, runRecords)
    set({ selfCheckResults: results })
  },

  clearAllData: () => {
    clearAllStorage()
    set({
      counterExamples: [],
      questionnaireRows: [],
      runRecords: [],
      conflictEvidences: [],
      selfCheckResults: [],
      toasts: [],
      gradientConfig: defaultGradientConfig,
    })
  },

  addToast: (type, message) => {
    const id = Date.now().toString() + Math.random().toString(36).slice(2)
    set((state) => ({ toasts: [...state.toasts, { id, type, message }] }))
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
    }, 4000)
  },

  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
  },

  setGradientConfig: (config) => {
    set((state) => ({ gradientConfig: { ...state.gradientConfig, ...config } }))
  },

  exportReport: () => {
    const { counterExamples, questionnaireRows, runRecords, conflictEvidences, selfCheckResults, gradientConfig } = get()
    return generateReport(counterExamples, questionnaireRows, runRecords, conflictEvidences, selfCheckResults)
  },

  loadSampleData: () => {
    const { importCounterExamples, importQuestionnaireRows } = get()
    const sampleCounterExamples: Record<MaterialSource, CounterExample[]> = {
      normal: normalMaterials,
      mismatch: mismatchMaterials,
      supplementary: supplementaryMaterials,
    }
    ;(
      Object.entries(sampleCounterExamples) as [MaterialSource, CounterExample[]][]
    ).forEach(([source, items]) => {
      importCounterExamples(items, source)
    })
    importQuestionnaireRows(createSampleQuestionnaireRows())
  },
}))

export default useAppStore
