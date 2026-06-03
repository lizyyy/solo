import { create } from "zustand"
import type {
  RangefinderRecord,
  ObstacleRemark,
  ObstructionPoint,
  ObstructionHistory,
  GradingResult,
  ValidationResult,
  ConflictEvidence,
  ApprovalAction,
} from "@/types"
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

export const useStore = create<AppState>((set, get) => ({
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
    set({ reviewedRecordIds: newReviewedIds })

    const historyEntry: ObstructionHistory = {
      id: `oh-review-${Date.now()}`,
      pointId: recordId,
      action: "补看障碍物备注",
      operator: "设备工程师-许工",
      timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
      detail: `许工补看 ${recordId} 的障碍物备注`,
    }
    set((s) => ({
      obstructionHistory: [...s.obstructionHistory, historyEntry],
    }))

    const conflicts = state.getConflictsForRecord(recordId)
    if (conflicts.length > 0) {
      set((s) => ({
        records: s.records.map((r) =>
          r.id === recordId ? { ...r, status: "conflict" as const } : r
        ),
        obstructionPoints: s.obstructionPoints.map((p) =>
          p.recordId === recordId && p.status === "normal"
            ? { ...p, status: "conflict" as const, reason: "测距仪记录与障碍物备注冲突，待工程师审批" }
            : p
        ),
      }))
    }

    if (newReviewedIds.length === state.importedRecordIds.length) {
      set({ workflowStep: "update_list" })
    }
  },

  updateObstructionList: (recordId: string) => {
    const state = get()
    if (!state.reviewedRecordIds.includes(recordId)) return
    const newUpdatedIds = [...new Set([...state.updatedPointIds, recordId])]
    set({ updatedPointIds: newUpdatedIds })

    const record = state.records.find((r) => r.id === recordId)
    if (!record) return

    const newPoints: ObstructionPoint[] = record.photoPoints
      .filter((pp) => !state.obstructionPoints.some((op) => op.recordId === recordId && Math.abs(op.longitude - pp.longitude) < 0.0001 && Math.abs(op.latitude - pp.latitude) < 0.0001))
      .map((pp, idx) => ({
        id: `op-new-${Date.now()}-${idx}`,
        label: `${record.slopeName}-点位${pp.sequenceNumber}`,
        longitude: pp.longitude,
        latitude: pp.latitude,
        status: "normal" as const,
        sourceType: "rangefinder" as const,
        confirmedBy: "",
        confirmedAt: "",
        reason: "",
        recordId: recordId,
      }))

    const historyEntries: ObstructionHistory[] = newPoints.map((p, idx) => ({
      id: `oh-update-${Date.now()}-${idx}`,
      pointId: p.id,
      action: "遮挡点清单更新",
      operator: "系统",
      timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
      detail: `${p.label} 加入遮挡点清单`,
    }))

    set((s) => ({
      obstructionPoints: [...s.obstructionPoints, ...newPoints],
      obstructionHistory: [...s.obstructionHistory, ...historyEntries],
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
}))
