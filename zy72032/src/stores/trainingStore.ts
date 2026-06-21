import { create } from "zustand"
import type { StepResult, PauseRecord, Scenario, Option } from "@/types"
import { calculateTotalScore } from "@/utils"
import { useLevelStore } from "./levelStore"
import { useRecordStore } from "./recordStore"

type TrainingStatus = "idle" | "active" | "paused" | "completed"

interface TrainingState {
  status: TrainingStatus
  currentStepIndex: number
  startTime: number
  stepStartTime: number
  steps: StepResult[]
  pauses: PauseRecord[]
  currentPauseStart: number | null
  currentPauseReason: string | undefined
  completedRecordId: string | null
  levelPackIdAtStart: string
  startTraining: () => void
  selectOption: (option: Option, timeTaken: number, timedOut: boolean) => void
  togglePause: (reason?: string) => void
  resetTraining: () => void
  getCurrentScenario: () => Scenario | undefined
}

export const useTrainingStore = create<TrainingState>((set, get) => ({
  status: "idle",
  currentStepIndex: 0,
  startTime: 0,
  stepStartTime: 0,
  steps: [],
  pauses: [],
  currentPauseStart: null,
  currentPauseReason: undefined,
  completedRecordId: null,
  levelPackIdAtStart: "",

  startTraining: () => {
    const levelPack = useLevelStore.getState().getSelectedLevelPack()
    if (!levelPack) return
    set({
      status: "active",
      currentStepIndex: 0,
      startTime: Date.now(),
      stepStartTime: Date.now(),
      steps: [],
      pauses: [],
      currentPauseStart: null,
      currentPauseReason: undefined,
      completedRecordId: null,
      levelPackIdAtStart: levelPack.id,
    })
  },

  getCurrentScenario: () => {
    const levelPack = useLevelStore.getState().levelPacks.find(
      (p) => p.id === get().levelPackIdAtStart
    )
    const { currentStepIndex } = get()
    return levelPack?.scenarios[currentStepIndex]
  },

  selectOption: (option, timeTaken, timedOut) => {
    const scenario = get().getCurrentScenario()
    if (!scenario) return

    const levelPack = useLevelStore.getState().levelPacks.find(
      (p) => p.id === get().levelPackIdAtStart
    )
    if (!levelPack) return

    if (get().status === "completed") return

    const correctOption = scenario.options.find(
      (o) => o.id === scenario.correctOptionId
    )

    const stepResult: StepResult = {
      scenarioId: scenario.id,
      customerMessage: scenario.customerMessage,
      selectedOptionId: option.id,
      selectedOptionText: option.text,
      correctOptionId: scenario.correctOptionId,
      correctOptionText: correctOption?.text ?? "",
      isCorrect: option.isCorrect,
      isBoundaryCase: scenario.isBoundaryCase ?? false,
      timeTaken,
      timeLimit: scenario.timeLimit,
      timedOut,
      deduction: option.deduction,
    }

    const newSteps = [...get().steps, stepResult]
    const isLastStep =
      get().currentStepIndex >= levelPack.scenarios.length - 1

    if (isLastStep) {
      const { score, maxScore } = calculateTotalScore(newSteps)
      const { pauses, startTime, levelPackIdAtStart } = get()
      const needsManualReview =
        newSteps.some((s) => s.isBoundaryCase && !s.isCorrect) ||
        (pauses.length > 0 &&
          Math.abs(score - levelPack.passingScore) <= 10)

      const record = useRecordStore.getState().addRecord({
        levelPackId: levelPackIdAtStart,
        levelPackName: levelPack.name,
        startTime,
        endTime: Date.now(),
        totalScore: score,
        maxScore,
        passed: score >= levelPack.passingScore,
        needsManualReview,
        steps: newSteps,
        pauses,
        source: "系统记录",
      })

      set({
        steps: newSteps,
        status: "completed",
        completedRecordId: record.id,
      })
    } else {
      set({
        steps: newSteps,
        status: "active",
        currentStepIndex: get().currentStepIndex + 1,
        stepStartTime: Date.now(),
      })
    }
  },

  togglePause: (reason) => {
    const { status, currentPauseStart, currentStepIndex, pauses, currentPauseReason } = get()
    if (status === "active") {
      set({
        status: "paused",
        currentPauseStart: Date.now(),
        currentPauseReason: reason,
      })
    } else if (status === "paused" && currentPauseStart) {
      const pauseDuration = Date.now() - currentPauseStart
      const pauseRecord: PauseRecord = {
        stepIndex: currentStepIndex,
        timestamp: currentPauseStart,
        duration: pauseDuration,
        reason: currentPauseReason,
      }
      set({
        status: "active",
        currentPauseStart: null,
        currentPauseReason: undefined,
        pauses: [...pauses, pauseRecord],
        stepStartTime: get().stepStartTime + pauseDuration,
      })
    }
  },

  resetTraining: () => {
    set({
      status: "idle",
      currentStepIndex: 0,
      startTime: 0,
      stepStartTime: 0,
      steps: [],
      pauses: [],
      currentPauseStart: null,
      currentPauseReason: undefined,
      completedRecordId: null,
      levelPackIdAtStart: "",
    })
  },
}))
