import { create } from "zustand"
import type { Experiment, DataSource, Metric, Judgment, EvaluationRecord, OperationLog, FilterState, DataSourceType, RecordStatus } from "@/types"
import { mockExperiments, mockDataSources, mockMetrics, mockJudgments, mockEvaluationRecords, mockOperationLogs } from "@/data/mockData"

interface AppState {
  experiments: Experiment[]
  dataSources: DataSource[]
  metrics: Metric[]
  judgments: Judgment[]
  evaluationRecords: EvaluationRecord[]
  operationLogs: OperationLog[]
  filters: FilterState
  selectedExperimentId: string | null

  setFilters: (filters: Partial<FilterState>) => void
  selectExperiment: (id: string | null) => void
  addDataSource: (ds: DataSource) => void
  rollbackDataSource: (id: string) => void
  addOperationLog: (log: OperationLog) => void
  confirmEvaluationRecord: (id: string) => void
  rejectEvaluationRecord: (id: string, reason: string) => void
  modifyEvaluationRecord: (id: string, data: Partial<EvaluationRecord>) => void
  importMockData: (type: DataSourceType, experimentId: string, fileName: string) => void

  getFilteredMetrics: () => Metric[]
  getCaliberChangedMetrics: () => Metric[]
  getExperimentDataSources: (experimentId: string) => DataSource[]
  getExperimentMetrics: (experimentId: string) => Metric[]
  getExperimentEvaluationRecords: (experimentId: string) => EvaluationRecord[]
  getExperimentOperationLogs: (experimentId: string) => OperationLog[]
}

export const useAppStore = create<AppState>((set, get) => ({
  experiments: mockExperiments,
  dataSources: mockDataSources,
  metrics: mockMetrics,
  judgments: mockJudgments,
  evaluationRecords: mockEvaluationRecords,
  operationLogs: mockOperationLogs,
  filters: { source: "all", status: "all", timeRange: "all" },
  selectedExperimentId: null,

  setFilters: (filters) =>
    set((state) => ({ filters: { ...state.filters, ...filters } })),

  selectExperiment: (id) => set({ selectedExperimentId: id }),

  addDataSource: (ds) =>
    set((state) => ({ dataSources: [...state.dataSources, ds] })),

  rollbackDataSource: (id) =>
    set((state) => ({
      dataSources: state.dataSources.map((ds) =>
        ds.id === id ? { ...ds, rolledBack: true } : ds
      ),
    })),

  addOperationLog: (log) =>
    set((state) => ({ operationLogs: [...state.operationLogs, log] })),

  confirmEvaluationRecord: (id) =>
    set((state) => ({
      evaluationRecords: state.evaluationRecords.map((er) =>
        er.id === id ? { ...er, status: "confirmed" as RecordStatus } : er
      ),
    })),

  rejectEvaluationRecord: (id, reason) =>
    set((state) => ({
      evaluationRecords: state.evaluationRecords.map((er) =>
        er.id === id
          ? { ...er, status: "pending" as RecordStatus, pendingItem: reason, modificationReason: reason }
          : er
      ),
    })),

  modifyEvaluationRecord: (id, data) =>
    set((state) => ({
      evaluationRecords: state.evaluationRecords.map((er) =>
        er.id === id ? { ...er, ...data } : er
      ),
    })),

  importMockData: (type, experimentId, fileName) => {
    const id = `ds-${Date.now()}`
    const ds: DataSource = {
      id,
      experimentId,
      type,
      fileName,
      importedAt: new Date().toLocaleString("zh-CN"),
      importedBy: "当前用户",
      rolledBack: false,
    }
    set((state) => ({
      dataSources: [...state.dataSources, ds],
      operationLogs: [
        ...state.operationLogs,
        {
          id: `ol-${Date.now()}`,
          experimentId,
          action: "import",
          operator: "当前用户",
          timestamp: new Date().toLocaleString("zh-CN"),
          detail: `导入${type === "evaluation" ? "评估表" : type === "online_feedback" ? "线上反馈" : "配置文件"}：${fileName}`,
        },
      ],
    }))
  },

  getFilteredMetrics: () => {
    const { metrics, filters } = get()
    return metrics.filter((m) => {
      if (filters.source !== "all" && m.source !== filters.source) return false
      return true
    })
  },

  getCaliberChangedMetrics: () =>
    get().metrics.filter((m) => m.caliberChanged),

  getExperimentDataSources: (experimentId) =>
    get().dataSources.filter((ds) => ds.experimentId === experimentId),

  getExperimentMetrics: (experimentId) =>
    get().metrics.filter((m) => m.experimentId === experimentId),

  getExperimentEvaluationRecords: (experimentId) =>
    get().evaluationRecords.filter((er) => er.experimentId === experimentId),

  getExperimentOperationLogs: (experimentId) =>
    get().operationLogs.filter((ol) => ol.experimentId === experimentId),
}))
