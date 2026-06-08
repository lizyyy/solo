import { create } from "zustand"
import { persist } from "zustand/middleware"
import type {
  RangefinderRecord,
  ObstacleRemark,
  ObstructionPoint,
  ObstructionHistory,
  GradingResult,
  ValidationResult,
  ConflictEvidence,
  ApprovalAction,
  SlopeGrade,
} from "@/types"
import { GRADE_LABELS } from "@/types"
import {
  MOCK_RANGEFINDER_RECORDS,
  MOCK_OBSTACLE_REMARKS,
  MOCK_OBSTRUCTION_POINTS,
  MOCK_OBSTRUCTION_HISTORY,
  MOCK_GRADING_RESULTS,
  MOCK_VALIDATION_RESULTS,
} from "@/data/mockData"

type WorkflowStep = "import" | "review_remark" | "update_list"

interface AppState {
  records: RangefinderRecord[]
  remarks: ObstacleRemark[]
  obstructionPoints: ObstructionPoint[]
  obstructionHistory: ObstructionHistory[]
  gradingResults: GradingResult[]
  validationResults: ValidationResult[]
  workflowStep: WorkflowStep
  importedRecordIds: string[]
  reviewedRecordIds: string[]
  updatedPointIds: string[]

  importRecords: (recordIds: string[]) => void
  reviewRemark: (recordId: string) => void
  updateObstructionList: (recordId: string) => void
  approveConflict: (pointId: string, action: ApprovalAction) => void
  reviewPendingPoint: (pointId: string, approved: boolean, reason: string) => void
  getConflictsForRecord: (recordId: string) => ConflictEvidence[]
  getHistoryForPoint: (pointId: string) => ObstructionHistory[]
  resetAll: () => void
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
  records: [...MOCK_RANGEFINDER_RECORDS],
  remarks: [...MOCK_OBSTACLE_REMARKS],
  obstructionPoints: [...MOCK_OBSTRUCTION_POINTS],
  obstructionHistory: [...MOCK_OBSTRUCTION_HISTORY],
  gradingResults: [...MOCK_GRADING_RESULTS],
  validationResults: [...MOCK_VALIDATION_RESULTS],
  workflowStep: "import",
  importedRecordIds: [],
  reviewedRecordIds: [],
  updatedPointIds: [],

  importRecords: (recordIds: string[]) => {
    const state = get()
    const newImportedIds = [...new Set([...state.importedRecordIds, ...recordIds])]
    set({ importedRecordIds: newImportedIds, workflowStep: "review_remark" })

    const newPoints: ObstructionPoint[] = []
    const newHistory: ObstructionHistory[] = []

    for (const rid of recordIds) {
      const record = state.records.find((r) => r.id === rid)
      if (!record) continue

      for (const pp of record.photoPoints) {
        const existingPoint = state.obstructionPoints.some(
          (op) => op.recordId === rid && Math.abs(op.longitude - pp.longitude) < 0.0001 && Math.abs(op.latitude - pp.latitude) < 0.0001
        )
        if (existingPoint) continue

        const hasCoord = record.coordinateRows.some((cr) => cr.sequenceNumber === pp.sequenceNumber)
        const pointId = `op-import-${rid}-${pp.sequenceNumber}-${Date.now()}`
        newPoints.push({
          id: pointId,
          label: `${record.slopeName}-点位${pp.sequenceNumber}`,
          longitude: pp.longitude,
          latitude: pp.latitude,
          status: hasCoord ? "normal" as const : "pending_review" as const,
          sourceType: "rangefinder" as const,
          confirmedBy: "",
          confirmedAt: "",
          reason: hasCoord ? "" : "照片有点位但坐标表缺一行，需安全员复核",
          recordId: rid,
        })
        newHistory.push({
          id: `oh-import-${rid}-${pp.sequenceNumber}-${Date.now()}`,
          pointId,
          action: hasCoord ? "导入" : "标记待复核",
          operator: hasCoord ? "安全员-张明" : "系统",
          timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
          detail: hasCoord
            ? `${record.slopeName}-点位${pp.sequenceNumber} 导入通过`
            : `${record.slopeName}-点位${pp.sequenceNumber} 照片有点位但坐标表缺一行，自动标记待复核`,
        })
      }
    }

    set((s) => ({
      obstructionPoints: [...s.obstructionPoints, ...newPoints],
      obstructionHistory: [...s.obstructionHistory, ...newHistory],
    }))
  },

  reviewRemark: (recordId: string) => {
    const state = get()
    if (!state.importedRecordIds.includes(recordId)) return
    const newReviewedIds = [...new Set([...state.reviewedRecordIds, recordId])]
    const now = new Date().toISOString().replace("T", " ").slice(0, 19)

    const conflicts = state.getConflictsForRecord(recordId)
    const hasConflicts = conflicts.length > 0

    const conflictSequences = new Set<number>()
    for (const c of conflicts) {
      const m = c.field.match(/点位(\d+)/)
      if (m) conflictSequences.add(parseInt(m[1]))
    }

    const newHistoryEntries: ObstructionHistory[] = []

    const updatedPoints = state.obstructionPoints.map((p) => {
      if (p.recordId !== recordId) return p
      const m = p.label.match(/点位(\d+)/)
      const seq = m ? parseInt(m[1]) : -1
      if (hasConflicts && conflictSequences.has(seq) && p.status === "normal") {
        newHistoryEntries.push({
          id: `oh-conflict-${p.id}-${Date.now()}`,
          pointId: p.id,
          action: "标记冲突",
          operator: "系统",
          timestamp: now,
          detail: `${p.label} 测距仪记录与障碍物备注冲突，待工程师审批`,
        })
        return { ...p, status: "conflict" as const, reason: "测距仪记录与障碍物备注冲突，待工程师审批" }
      }
      return p
    })

    const remark = state.remarks.find((r) => r.recordId === recordId)
    const reviewedPointIds = state.obstructionPoints
      .filter((p) => p.recordId === recordId)
      .map((p) => p.id)

    for (const pid of reviewedPointIds) {
      newHistoryEntries.push({
        id: `oh-review-${pid}-${Date.now()}`,
        pointId: pid,
        action: "补看障碍物备注",
        operator: "设备工程师-许工",
        timestamp: now,
        detail: remark ? `许工补看障碍物备注：${remark.remarkText}` : `许工补看 ${recordId} 的障碍物备注`,
      })
    }

    set((s) => ({
      reviewedRecordIds: newReviewedIds,
      records: s.records.map((r) =>
        r.id === recordId && hasConflicts
          ? { ...r, status: "conflict" as const }
          : r
      ),
      obstructionPoints: updatedPoints,
      obstructionHistory: [...s.obstructionHistory, ...newHistoryEntries],
    }))

    if (newReviewedIds.length === state.importedRecordIds.length) {
      set({ workflowStep: "update_list" })
    }
  },

  updateObstructionList: (recordId: string) => {
    const state = get()
    if (!state.reviewedRecordIds.includes(recordId)) return
    if (state.updatedPointIds.includes(recordId)) return
    const newUpdatedIds = [...new Set([...state.updatedPointIds, recordId])]
    set({ updatedPointIds: newUpdatedIds })

    const now = new Date().toISOString().replace("T", " ").slice(0, 19)
    const record = state.records.find((r) => r.id === recordId)
    if (!record) return

    const pointsForRecord = state.obstructionPoints.filter((p) => p.recordId === recordId)
    const gradableStatuses: Array<ObstructionPoint["status"]> = ["normal", "supplemented"]
    const newGradings: GradingResult[] = []
    const newHistory: ObstructionHistory[] = []

    for (const point of pointsForRecord) {
      const alreadyGraded = state.gradingResults.some((g) => g.pointId === point.id)
      if (alreadyGraded) continue
      if (!gradableStatuses.includes(point.status)) continue

      const coordRow = record.coordinateRows.find((cr) => {
        const m = point.label.match(/点位(\d+)/)
        return m ? cr.sequenceNumber === parseInt(m[1]) : false
      })
      const elevation = coordRow?.elevation ?? 0
      const slopeAngle = elevation > 0 ? Math.abs(Math.atan2(elevation - 1280, 100) * 180 / Math.PI) : 8.5
      const slopeGrade: SlopeGrade =
        slopeAngle < 10 ? "beginner" :
        slopeAngle < 18 ? "intermediate" :
        slopeAngle < 26 ? "advanced" : "expert"

      const tradeoffReason = point.status === "supplemented"
        ? `补录数据纳入分级。理由：${point.reason}`
        : ""

      newGradings.push({
        id: `gr-${point.id}-${Date.now()}`,
        pointId: point.id,
        slopeName: record.slopeName,
        slopeGrade,
        slopeAngle: parseFloat(slopeAngle.toFixed(1)),
        paramVersion: "SLOPE-CALC-v2.3",
        modelVersion: "GRADE-MODEL-v1.1",
        tradeoffReason,
        calculatedAt: now,
      })

      newHistory.push({
        id: `oh-grade-${point.id}-${Date.now()}`,
        pointId: point.id,
        action: "分级计算",
        operator: "系统",
        timestamp: now,
        detail: `${point.label} 坡度分级为${GRADE_LABELS[slopeGrade]}（${slopeAngle.toFixed(1)}°）`,
      })
    }

    newHistory.push({
      id: `oh-update-${recordId}-${Date.now()}`,
      pointId: recordId,
      action: "遮挡点清单更新",
      operator: "系统",
      timestamp: now,
      detail: `${record.slopeName} 遮挡点清单更新完成`,
    })

    set((s) => ({
      gradingResults: [...s.gradingResults, ...newGradings],
      obstructionHistory: [...s.obstructionHistory, ...newHistory],
    }))
  },

  approveConflict: (pointId: string, action: ApprovalAction) => {
    set((s) => ({
      obstructionPoints: s.obstructionPoints.map((p) =>
        p.id === pointId
          ? {
              ...p,
              status: action.action === "confirm" ? "supplemented" as const : "rejected" as const,
              confirmedBy: action.operator,
              confirmedAt: action.timestamp,
              reason: action.reason,
            }
          : p
      ),
      obstructionHistory: [
        ...s.obstructionHistory,
        {
          id: `oh-approve-${Date.now()}`,
          pointId,
          action: action.action === "confirm" ? "冲突确认" : "冲突驳回",
          operator: action.operator,
          timestamp: action.timestamp,
          detail: `${action.operator} ${action.action === "confirm" ? "确认" : "驳回"}冲突，理由：${action.reason}`,
        },
      ],
    }))

    const point = get().obstructionPoints.find((p) => p.id === pointId)
    if (point && action.action === "confirm") {
      const newGrading: GradingResult = {
        id: `gr-${Date.now()}`,
        pointId,
        slopeName: point.label.split("-")[0],
        slopeGrade: "intermediate",
        slopeAngle: 18.5,
        paramVersion: "SLOPE-CALC-v2.3",
        modelVersion: "GRADE-MODEL-v1.1",
        tradeoffReason: `冲突确认，采用${point.sourceType === "obstacle_remark" ? "障碍物备注" : "测距仪"}数据。理由：${action.reason}`,
        calculatedAt: new Date().toISOString().replace("T", " ").slice(0, 19),
      }
      set((s) => ({
        gradingResults: [...s.gradingResults, newGrading],
      }))
    }
  },

  reviewPendingPoint: (pointId: string, approved: boolean, reason: string) => {
    const now = new Date().toISOString().replace("T", " ").slice(0, 19)
    set((s) => ({
      obstructionPoints: s.obstructionPoints.map((p) =>
        p.id === pointId
          ? {
              ...p,
              status: approved ? "supplemented" as const : "rejected" as const,
              confirmedBy: approved ? "安全员-张明" : "安全员-张明",
              confirmedAt: now,
              reason,
            }
          : p
      ),
      obstructionHistory: [
        ...s.obstructionHistory,
        {
          id: `oh-pending-${Date.now()}`,
          pointId,
          action: approved ? "复核通过" : "复核驳回",
          operator: "安全员-张明",
          timestamp: now,
          detail: `安全员复核：${approved ? "通过" : "驳回"}。理由：${reason}`,
        },
      ],
    }))
  },

  getConflictsForRecord: (recordId: string) => {
    const state = get()
    const record = state.records.find((r) => r.id === recordId)
    const remark = state.remarks.find((r) => r.recordId === recordId)
    if (!record || !remark) return []

    const conflicts: ConflictEvidence[] = []
    for (const entry of remark.entries) {
      const coordRow = record.coordinateRows.find(
        (cr) => cr.sequenceNumber === entry.sequenceNumber
      )
      if (coordRow) {
        if (
          Math.abs(coordRow.longitude - entry.longitude) > 0.0001 ||
          Math.abs(coordRow.latitude - entry.latitude) > 0.0001
        ) {
          conflicts.push({
            field: `点位${entry.sequenceNumber}坐标`,
            rangefinderValue: `经度: ${coordRow.longitude}, 纬度: ${coordRow.latitude}`,
            remarkValue: `经度: ${entry.longitude}, 纬度: ${entry.latitude}`,
            timestamp: remark.recordedAt,
          })
        }
      }
    }
    return conflicts
  },

  getHistoryForPoint: (pointId: string) => {
    return get().obstructionHistory.filter((h) => h.pointId === pointId)
  },

  resetAll: () => {
    set({
      records: [...MOCK_RANGEFINDER_RECORDS],
      remarks: [...MOCK_OBSTACLE_REMARKS],
      obstructionPoints: [...MOCK_OBSTRUCTION_POINTS],
      obstructionHistory: [...MOCK_OBSTRUCTION_HISTORY],
      gradingResults: [...MOCK_GRADING_RESULTS],
      validationResults: [...MOCK_VALIDATION_RESULTS],
      workflowStep: "import",
      importedRecordIds: [],
      reviewedRecordIds: [],
      updatedPointIds: [],
    })
  },
}),
    {
      name: "slope-grading-store",
      partialize: (state) => ({
        records: state.records,
        remarks: state.remarks,
        obstructionPoints: state.obstructionPoints,
        obstructionHistory: state.obstructionHistory,
        gradingResults: state.gradingResults,
        validationResults: state.validationResults,
        workflowStep: state.workflowStep,
        importedRecordIds: state.importedRecordIds,
        reviewedRecordIds: state.reviewedRecordIds,
        updatedPointIds: state.updatedPointIds,
      }),
    }
  )
)
