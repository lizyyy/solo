import { create } from "zustand"
import type {
  Sample,
  FeatureColumn,
  LabelColumn,
  LabelAssignment,
  DataBatch,
  ConflictReport,
  HistoryEntry,
  BatchStatus,
  AxisMapping,
  OperationType,
} from "@/types"
import {
  computePCAProjection,
  computeAxisProjection,
  computePCAVarianceRatios,
  detectOutliers,
  detectLabelConflicts,
  parseCSV,
  generateDemoData,
} from "@/utils/dataEngine"

interface ClusterStore {
  datasetId: string
  datasetName: string
  samples: Sample[]
  featureColumns: FeatureColumn[]
  labelColumns: LabelColumn[]
  labelAssignments: LabelAssignment[]
  dataBatches: DataBatch[]
  conflicts: ConflictReport[]
  history: HistoryEntry[]

  outlierThreshold: number
  selectedSampleId: string | null
  hoveredSampleId: string | null
  showHistoryPanel: boolean

  projectionMode: "pca" | "axis"
  varianceRatios: number[]

  initDemo: () => void
  loadCSVData: (text: string, fileName: string) => ConflictReport | null
  toggleFeature: (featureId: string) => void
  setAxisMapping: (featureId: string, axis: AxisMapping) => void
  reorderFeatures: (activeId: string, overId: string) => void
  setOutlierThreshold: (val: number) => void
  setSelectedSample: (id: string | null) => void
  setHoveredSample: (id: string | null) => void
  setLabelForSample: (sampleId: string, clusterId: number) => void
  setBatchStatus: (batchId: string, status: BatchStatus, reason?: string) => void
  resolveConflict: (conflictId: string, applyNew: boolean) => void
  rollbackTo: (historyId: string) => void
  toggleHistoryPanel: () => void
  recomputeProjection: () => void
  recomputeOutliers: () => void
  getFeatureMatrix: () => { matrix: number[][]; sampleIds: string[] }
}

let nextId = 1
const uid = () => `id_${nextId++}_${Date.now()}`

const addHistory = (
  history: HistoryEntry[],
  operationType: OperationType,
  targetType: string,
  targetId: string,
  beforeValue: string,
  afterValue: string
): HistoryEntry[] => {
  const entry: HistoryEntry = {
    id: uid(),
    timestamp: new Date().toISOString(),
    operationType,
    targetType,
    targetId,
    beforeValue,
    afterValue,
    operator: "user",
  }
  return [entry, ...history]
}

export const useClusterStore = create<ClusterStore>((set, get) => ({
  datasetId: uid(),
  datasetName: "未命名数据集",
  samples: [],
  featureColumns: [],
  labelColumns: [],
  labelAssignments: [],
  dataBatches: [],
  conflicts: [],
  history: [],
  outlierThreshold: 2.0,
  selectedSampleId: null,
  hoveredSampleId: null,
  showHistoryPanel: false,
  projectionMode: "pca",
  varianceRatios: [],

  getFeatureMatrix: () => {
    const state = get()
    const selectedFeatures = state.featureColumns
      .filter((f) => f.selected)
      .sort((a, b) => a.order - b.order)

    if (selectedFeatures.length === 0 || state.samples.length === 0) {
      return { matrix: [], sampleIds: [] }
    }

    const sampleIds = state.samples.map((s) => s.id)
    const matrix: number[][] = []

    for (const sample of state.samples) {
      const row: number[] = []
      for (const feature of selectedFeatures) {
        const assignment = state.labelAssignments.find(
          (la) => la.sampleId === sample.id && la.columnId === feature.id
        )
        row.push(assignment ? assignment.clusterId : 0)
      }
      matrix.push(row)
    }

    return { matrix, sampleIds }
  },

  initDemo: () => {
    const { headers, rows } = generateDemoData()
    const did = uid()

    const featureNames = headers.filter((h) => h !== "id" && h !== "cluster")
    const featureCols: FeatureColumn[] = featureNames.map((name, i) => ({
      id: `feat_${name}`,
      datasetId: did,
      name,
      dataType: "numeric" as const,
      selected: true,
      axisMapping: i < 3 ? (["x", "y", "z"] as const)[i] : null,
      order: i,
    }))

    const labelCol: LabelColumn = {
      id: "label_cluster",
      datasetId: did,
      name: "cluster",
      isPrimary: true,
    }

    const featureMatrix: number[][] = []
    const sampleIds: string[] = []
    const labels: LabelAssignment[] = []

    for (const row of rows) {
      const sid = String(row.id)
      sampleIds.push(sid)

      const featRow: number[] = []
      for (const fn of featureNames) {
        featRow.push(Number(row[fn]) || 0)
      }
      featureMatrix.push(featRow)

      labels.push({
        sampleId: sid,
        columnId: labelCol.id,
        clusterId: Number(row.cluster) || 0,
        manuallyModified: false,
      })
    }

    const samples = computePCAProjection(featureMatrix, sampleIds, did)
    const varianceRatios = computePCAVarianceRatios(featureMatrix)

    const batch: DataBatch = {
      id: uid(),
      datasetId: did,
      fileName: "demo_data.csv",
      status: "processed",
      loadedAt: new Date().toISOString(),
    }

    const outliers = detectOutliers(samples, labels, 2.0)
    const updatedSamples = samples.map((s) => ({
      ...s,
      isOutlier: outliers.has(s.id),
      outlierScore: outliers.get(s.id) || 0,
    }))

    set({
      datasetId: did,
      datasetName: "演示数据集",
      samples: updatedSamples,
      featureColumns: featureCols,
      labelColumns: [labelCol],
      labelAssignments: labels,
      dataBatches: [batch],
      conflicts: [],
      history: [],
      outlierThreshold: 2.0,
      varianceRatios,
      projectionMode: "pca",
    })
  },

  loadCSVData: (text, fileName) => {
    const { headers, rows } = parseCSV(text)
    if (headers.length === 0 || rows.length === 0) return null

    const state = get()
    const did = state.datasetId
    let conflictResult: ConflictReport | null = null

    const featureNames = headers.filter((h) => h !== "id" && isNaN(Number(rows[0]?.[h])))
    const possibleLabelNames = headers.filter(
      (h) =>
        h !== "id" &&
        !featureNames.includes(h) &&
        (h.toLowerCase().includes("cluster") ||
          h.toLowerCase().includes("label") ||
          h.toLowerCase().includes("class"))
    )

    const existingFeatureNames = new Set(state.featureColumns.map((f) => f.name))
    const newFeatureNames = featureNames.filter((n) => !existingFeatureNames.has(n))
    const newFeatures: FeatureColumn[] = newFeatureNames.map((name, i) => ({
      id: `feat_${name}_${Date.now()}`,
      datasetId: did,
      name,
      dataType: "numeric" as const,
      selected: true,
      axisMapping: null,
      order: state.featureColumns.length + i,
    }))

    const existingLabelNames = new Set(state.labelColumns.map((l) => l.name))
    const newLabelNames = possibleLabelNames.filter((n) => !existingLabelNames.has(n))
    const newLabels: LabelColumn[] = newLabelNames.map((name) => ({
      id: `label_${name}_${Date.now()}`,
      datasetId: did,
      name,
      isPrimary: state.labelColumns.length === 0,
    }))

    const existingSampleIds = new Set(state.samples.map((s) => s.id))
    const newSampleIds: string[] = []
    const newLabelAssignments: LabelAssignment[] = []

    for (const row of rows) {
      const sid = String(row.id ?? `sample_auto_${Date.now()}_${newSampleIds.length}`)
      newSampleIds.push(sid)

      for (const ln of newLabelNames) {
        const clusterVal = Number(row[ln]) ?? 0
        newLabelAssignments.push({
          sampleId: sid,
          columnId: `label_${ln}_${Date.now()}`,
          clusterId: clusterVal,
          manuallyModified: false,
        })
      }
    }

    if (newLabelNames.length > 0 && state.labelColumns.length > 0) {
      const existingPrimary = state.labelColumns.find((l) => l.isPrimary)
      if (existingPrimary) {
        conflictResult = detectLabelConflicts(
          state.labelAssignments.filter((la) => la.columnId === existingPrimary.id),
          newLabelAssignments,
          newLabelNames[0],
          existingPrimary.name
        )
        if (conflictResult) {
          conflictResult.batchId = `batch_${Date.now()}`
        }
      }
    }

    const allFeatures = [...state.featureColumns, ...newFeatures]
    const allLabels = [...state.labelColumns, ...newLabels]

    const selectedFeatures = allFeatures.filter((f) => f.selected).sort((a, b) => a.order - b.order)

    const featureMatrix: number[][] = []
    const allSampleIds = [...state.samples.map((s) => s.id), ...newSampleIds]

    for (const sid of allSampleIds) {
      const row: number[] = []
      for (const feature of selectedFeatures) {
        const sampleRow = rows.find((r) => String(r.id) === sid || String(r[`sample_${sid}`]) === sid)
        const val = sampleRow ? Number(sampleRow[feature.name]) || 0 : 0
        row.push(val)
      }
      featureMatrix.push(row)
    }

    const isOnlyNewSamples =
      newFeatureNames.length === 0 && newLabelNames.length === 0 && newSampleIds.length > 0

    let newSamples: Sample[]
    if (featureMatrix.length > 0 && featureMatrix[0].length >= 3) {
      newSamples = computePCAProjection(featureMatrix, allSampleIds, did)
    } else {
      newSamples = [
        ...state.samples,
        ...newSampleIds.map((id, i) => ({
          id,
          datasetId: did,
          index: state.samples.length + i,
          projectedX: Math.random() * 4 - 2,
          projectedY: Math.random() * 4 - 2,
          projectedZ: Math.random() * 4 - 2,
          targetX: Math.random() * 4 - 2,
          targetY: Math.random() * 4 - 2,
          targetZ: Math.random() * 4 - 2,
          isOutlier: false,
          outlierScore: 0,
        })),
      ]
    }

    const batch: DataBatch = {
      id: uid(),
      datasetId: did,
      fileName,
      status: conflictResult ? "pending" : "processed",
      loadedAt: new Date().toISOString(),
    }

    const allLabelAssignments = [...state.labelAssignments, ...newLabelAssignments]
    const varianceRatios = featureMatrix.length > 0 ? computePCAVarianceRatios(featureMatrix) : []

    const outliers = detectOutliers(newSamples, allLabelAssignments, state.outlierThreshold)
    const updatedSamples = newSamples.map((s) => ({
      ...s,
      isOutlier: outliers.has(s.id),
      outlierScore: outliers.get(s.id) || 0,
    }))

    set({
      samples: updatedSamples,
      featureColumns: allFeatures,
      labelColumns: allLabels,
      labelAssignments: allLabelAssignments,
      dataBatches: [...state.dataBatches, batch],
      conflicts: conflictResult ? [...state.conflicts, conflictResult] : state.conflicts,
      varianceRatios,
      history: addHistory(state.history, "data_merge", "file", batch.id, "", fileName),
    })

    return conflictResult
  },

  toggleFeature: (featureId) => {
    const state = get()
    const feature = state.featureColumns.find((f) => f.id === featureId)
    if (!feature) return

    const newSelected = !feature.selected

    const updatedFeatures = state.featureColumns.map((f) => {
      if (f.id === featureId) {
        return { ...f, selected: newSelected, axisMapping: newSelected ? f.axisMapping : null }
      }
      return f
    })

    const selectedCount = updatedFeatures.filter((f) => f.selected).length
    if (selectedCount < 3 && newSelected) {
      const axes: AxisMapping[] = ["x", "y", "z"]
      const usedAxes = new Set(updatedFeatures.filter((f) => f.axisMapping).map((f) => f.axisMapping))
      const freeAxis = axes.find((a) => !usedAxes.has(a))
      if (freeAxis) {
        const fi = updatedFeatures.findIndex((f) => f.id === featureId)
        if (fi >= 0) updatedFeatures[fi] = { ...updatedFeatures[fi], axisMapping: freeAxis }
      }
    }

    set({
      featureColumns: updatedFeatures,
      history: addHistory(
        state.history,
        "feature_toggle",
        "feature",
        featureId,
        String(!newSelected),
        String(newSelected)
      ),
    })

    get().recomputeProjection()
  },

  setAxisMapping: (featureId, axis) => {
    const state = get()
    const updatedFeatures = state.featureColumns.map((f) => {
      if (f.id === featureId) return { ...f, axisMapping: axis }
      if (f.axisMapping === axis) return { ...f, axisMapping: null }
      return f
    })

    set({
      featureColumns: updatedFeatures,
      projectionMode: axis !== null ? "axis" : state.projectionMode,
    })

    get().recomputeProjection()
  },

  reorderFeatures: (activeId, overId) => {
    const state = get()
    const features = [...state.featureColumns]
    const activeIdx = features.findIndex((f) => f.id === activeId)
    const overIdx = features.findIndex((f) => f.id === overId)
    if (activeIdx < 0 || overIdx < 0) return

    const [moved] = features.splice(activeIdx, 1)
    features.splice(overIdx, 0, moved)
    const reordered = features.map((f, i) => ({ ...f, order: i }))

    set({ featureColumns: reordered })
  },

  setOutlierThreshold: (val) => {
    const state = get()
    set({
      outlierThreshold: val,
      history: addHistory(
        state.history,
        "threshold_adjust",
        "outlier",
        "global",
        String(state.outlierThreshold),
        String(val)
      ),
    })
    get().recomputeOutliers()
  },

  setSelectedSample: (id) => set({ selectedSampleId: id }),
  setHoveredSample: (id) => set({ hoveredSampleId: id }),

  setLabelForSample: (sampleId, clusterId) => {
    const state = get()
    const primaryLabel = state.labelColumns.find((l) => l.isPrimary) ?? state.labelColumns[0]
    if (!primaryLabel) return

    const existingIdx = state.labelAssignments.findIndex(
      (la) => la.sampleId === sampleId && la.columnId === primaryLabel.id
    )

    const oldCluster =
      existingIdx >= 0 ? state.labelAssignments[existingIdx].clusterId : -1

    const updatedLabels =
      existingIdx >= 0
        ? state.labelAssignments.map((la, i) =>
            i === existingIdx ? { ...la, clusterId, manuallyModified: true } : la
          )
        : [
            ...state.labelAssignments,
            { sampleId, columnId: primaryLabel.id, clusterId, manuallyModified: true },
          ]

    set({
      labelAssignments: updatedLabels,
      selectedSampleId: null,
      history: addHistory(
        state.history,
        "label_change",
        "sample",
        sampleId,
        `簇${oldCluster}`,
        `簇${clusterId}`
      ),
    })

    get().recomputeOutliers()
  },

  setBatchStatus: (batchId, status, reason) => {
    const state = get()
    const batch = state.dataBatches.find((b) => b.id === batchId)
    if (!batch) return

    const oldStatus = batch.status
    const updatedBatches = state.dataBatches.map((b) =>
      b.id === batchId ? { ...b, status, rejectReason: status === "rejected" ? reason : b.rejectReason } : b
    )

    set({
      dataBatches: updatedBatches,
      history: addHistory(state.history, "status_change", "batch", batchId, oldStatus, status),
    })
  },

  resolveConflict: (conflictId, applyNew) => {
    const state = get()
    const conflict = state.conflicts.find((c) => c.id === conflictId)
    if (!conflict) return

    if (applyNew) {
      const primaryLabel = state.labelColumns.find((l) => l.isPrimary)
      if (primaryLabel) {
        const newLabels = state.labelAssignments.map((la) => {
          if (la.columnId === primaryLabel.id && conflict.affectedSampleIds.includes(la.sampleId) && !la.manuallyModified) {
            return { ...la, manuallyModified: true }
          }
          return la
        })
        set({ labelAssignments: newLabels })
      }
    }

    set({
      conflicts: state.conflicts.map((c) => (c.id === conflictId ? { ...c, resolved: true } : c)),
      dataBatches: state.dataBatches.map((b) =>
        b.id === conflict.batchId ? { ...b, status: applyNew ? "processed" : "rejected", rejectReason: applyNew ? undefined : "标签冲突未解决" } : b
      ),
    })
  },

  rollbackTo: (historyId) => {
    const state = get()
    const entryIdx = state.history.findIndex((h) => h.id === historyId)
    if (entryIdx < 0) return

    const entriesToRollback = state.history.slice(0, entryIdx + 1)
    const entry = entriesToRollback[0]

    set({
      history: addHistory(
        state.history,
        "rollback",
        "history",
        historyId,
        entry.afterValue,
        entry.beforeValue
      ),
    })
  },

  toggleHistoryPanel: () => set((s) => ({ showHistoryPanel: !s.showHistoryPanel })),

  recomputeProjection: () => {
    const state = get()
    const selectedFeatures = state.featureColumns
      .filter((f) => f.selected)
      .sort((a, b) => a.order - b.order)

    if (selectedFeatures.length < 3 || state.samples.length === 0) return

    const axisMapped = selectedFeatures.filter((f) => f.axisMapping)
    const usingAxis = axisMapped.length >= 3 && axisMapped.every((f) => f.axisMapping !== null)

    let newSamples: Sample[]

    if (usingAxis) {
      const xFeature = axisMapped.find((f) => f.axisMapping === "x")
      const yFeature = axisMapped.find((f) => f.axisMapping === "y")
      const zFeature = axisMapped.find((f) => f.axisMapping === "z")

      if (!xFeature || !yFeature || !zFeature) return

      const xIdx = selectedFeatures.indexOf(xFeature)
      const yIdx = selectedFeatures.indexOf(yFeature)
      const zIdx = selectedFeatures.indexOf(zFeature)

      const featureMatrix: number[][] = []
      const sampleIds: string[] = []

      for (const sample of state.samples) {
        sampleIds.push(sample.id)
        const row: number[] = []
        for (const feature of selectedFeatures) {
          row.push(0)
        }
        featureMatrix.push(row)
      }

      newSamples = computeAxisProjection(
        featureMatrix,
        sampleIds,
        state.datasetId,
        xIdx,
        yIdx,
        zIdx
      )
      set({ projectionMode: "axis" })
    } else {
      const featureMatrix: number[][] = []
      const sampleIds: string[] = []

      for (const sample of state.samples) {
        sampleIds.push(sample.id)
        const row: number[] = []
        for (const _feature of selectedFeatures) {
          row.push(0)
        }
        featureMatrix.push(row)
      }

      newSamples = computePCAProjection(featureMatrix, sampleIds, state.datasetId)
      const varianceRatios = computePCAVarianceRatios(featureMatrix)
      set({ projectionMode: "pca", varianceRatios })
    }

    const updatedSamples = state.samples.map((s, i) => ({
      ...s,
      targetX: newSamples[i]?.targetX ?? s.targetX,
      targetY: newSamples[i]?.targetY ?? s.targetY,
      targetZ: newSamples[i]?.targetZ ?? s.targetZ,
    }))

    set({ samples: updatedSamples })
    get().recomputeOutliers()
  },

  recomputeOutliers: () => {
    const state = get()
    const primaryLabel = state.labelColumns.find((l) => l.isPrimary) ?? state.labelColumns[0]
    if (!primaryLabel) return

    const relevantLabels = state.labelAssignments.filter((la) => la.columnId === primaryLabel.id)
    const outliers = detectOutliers(state.samples, relevantLabels, state.outlierThreshold)

    set({
      samples: state.samples.map((s) => ({
        ...s,
        isOutlier: outliers.has(s.id),
        outlierScore: outliers.get(s.id) || 0,
      })),
    })
  },
}))
