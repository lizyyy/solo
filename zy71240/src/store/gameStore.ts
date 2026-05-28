import { create } from "zustand"
import type {
  GamePhase,
  GameSession,
  ClueItem,
  Judgment,
  Settlement,
  ErrorImpact,
  DamageReport,
  AmendmentRecord,
  RepairGrade,
  RiskLevel,
} from "@/types"
import { buildClueItems } from "@/data/mockData"
import { runSettlement, getPriceForGrade, createAmendment } from "@/engine/rules"

interface GameState {
  currentCaseId: string | null
  session: GameSession | null
  phase: GamePhase
  selectedClues: ClueItem[]
  maxClueSelections: number
  judgments: Judgment[]
  riskLevel: RiskLevel | null
  settlement: Settlement | null
  errorImpacts: ErrorImpact[]
  report: DamageReport | null
  amendments: AmendmentRecord[]
  timeRemaining: number

  startGame: (caseId: string, playerName: string) => void
  selectClue: (clue: ClueItem) => void
  deselectClue: (clueId: string) => void
  setJudgment: (partName: string, grade: RepairGrade) => void
  removeJudgment: (partName: string) => void
  setRiskLevel: (level: RiskLevel) => void
  submitJudgments: () => void
  runSettlementPhase: () => void
  goToPhase: (phase: GamePhase) => void
  addAmendment: (fieldName: string, oldValue: string, newValue: string, reason: string) => void
  setReport: (report: DamageReport) => void
  resetGame: () => void
  tick: () => void
  getAllAmendments: () => AmendmentRecord[]
}

const INITIAL_TIME = 180

export const useGameStore = create<GameState>((set, get) => ({
  currentCaseId: null,
  session: null,
  phase: "opening",
  selectedClues: [],
  maxClueSelections: 5,
  judgments: [],
  riskLevel: null,
  settlement: null,
  errorImpacts: [],
  report: null,
  amendments: [],
  timeRemaining: INITIAL_TIME,

  startGame: (caseId, playerName) => {
    const session: GameSession = {
      id: `session-${Date.now()}`,
      caseId,
      playerName,
      startedAt: Date.now(),
      finishedAt: null,
      timeSpent: 0,
      phase: "opening",
    }
    set({
      currentCaseId: caseId,
      session,
      phase: "opening",
      selectedClues: [],
      judgments: [],
      riskLevel: null,
      settlement: null,
      errorImpacts: [],
      report: null,
      amendments: [],
      timeRemaining: INITIAL_TIME,
    })
  },

  selectClue: (clue) => {
    const { selectedClues, maxClueSelections } = get()
    if (selectedClues.length >= maxClueSelections) return
    if (selectedClues.find((c) => c.id === clue.id)) return
    set({ selectedClues: [...selectedClues, clue] })
  },

  deselectClue: (clueId) => {
    const { selectedClues } = get()
    set({ selectedClues: selectedClues.filter((c) => c.id !== clueId) })
  },

  setJudgment: (partName, grade) => {
    const { currentCaseId, judgments } = get()
    if (!currentCaseId) return
    const estimatedPayout = getPriceForGrade(currentCaseId, partName, grade)
    const existing = judgments.findIndex((j) => j.partName === partName)
    const newJudgment: Judgment = {
      id: `j-${partName}-${Date.now()}`,
      sessionId: get().session?.id || "",
      partName,
      repairGrade: grade,
      estimatedPayout,
    }
    if (existing >= 0) {
      const updated = [...judgments]
      updated[existing] = newJudgment
      set({ judgments: updated })
    } else {
      set({ judgments: [...judgments, newJudgment] })
    }
  },

  removeJudgment: (partName) => {
    const { judgments } = get()
    set({ judgments: judgments.filter((j) => j.partName !== partName) })
  },

  setRiskLevel: (level) => {
    set({ riskLevel: level })
  },

  submitJudgments: () => {
    const { phase } = get()
    if (phase === "clues") {
      set({ phase: "judge" })
    }
  },

  runSettlementPhase: () => {
    const { currentCaseId, selectedClues, judgments, riskLevel, session } = get()
    if (!currentCaseId || !riskLevel) return
    const { settlement, errorImpacts } = runSettlement(
      currentCaseId,
      selectedClues,
      judgments,
      riskLevel
    )
    const report: DamageReport = {
      id: `report-${Date.now()}`,
      sessionId: session?.id || "",
      judgments: [...judgments],
      settlement,
      errorImpacts: [...errorImpacts],
      createdAt: Date.now(),
      status: "已提交",
    }
    set({ settlement, errorImpacts, report, phase: "settle" })
  },

  goToPhase: (phase) => {
    set({ phase })
  },

  addAmendment: (fieldName, oldValue, newValue, reason) => {
    const { report, amendments, session, judgments, settlement, errorImpacts } = get()
    let currentReport = report
    if (!currentReport) {
      currentReport = {
        id: `report-${Date.now()}`,
        sessionId: session?.id || "",
        judgments: [...judgments],
        settlement,
        errorImpacts: [...errorImpacts],
        createdAt: Date.now(),
        status: "草稿",
      }
    }
    const amendment = createAmendment(
      currentReport.id,
      fieldName,
      oldValue,
      newValue,
      reason,
      "讲师"
    )
    set({
      report: { ...currentReport, status: "已修正" as const },
      amendments: [...amendments, amendment],
    })
  },

  setReport: (report) => {
    set({ report })
  },

  resetGame: () => {
    set({
      currentCaseId: null,
      session: null,
      phase: "opening",
      selectedClues: [],
      judgments: [],
      riskLevel: null,
      settlement: null,
      errorImpacts: [],
      report: null,
      amendments: [],
      timeRemaining: INITIAL_TIME,
    })
  },

  tick: () => {
    const { timeRemaining } = get()
    if (timeRemaining <= 0) return
    set({ timeRemaining: timeRemaining - 1 })
  },

  getAllAmendments: () => {
    return get().amendments
  },
}))

export function getAvailableClues(caseId: string): ClueItem[] {
  return buildClueItems(caseId)
}
