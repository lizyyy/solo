import { create } from "zustand"
import type { StepResult, PauseRecord, Scenario, Option } from "@/types"
import { generateId, calculateTotalScore } from "@/utils"
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
  startTraining: () => void
  selectOption: (option: Option, timeTaken: number, timedOut: boolean) => void
  togglePause: (reason?: string) => void
  completeTraining: () => string
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
    })
  },
  getCurrentScenario: () => {
    const levelPack = useLevelStore.getState().getSelectedLevelPack()
    const { currentStepIndex } = get()
    return levelPack?.scenarios[currentStepIndex]
  },
  selectOption: (option, timeTaken, timedOut) => {
    const scenario = get().getCurrentScenario()
    if (!scenario) return

    const levelPack = useLevelStore.getState().getSelectedLevelPack()
    if (!levelPack) return

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

    set({
      steps: newSteps,
      status: isLastStep ? "completed" : "active",
      currentStepIndex: isLastStep
        ? get().currentStepIndex
        : get().currentStepIndex + 1,
      stepStartTime: Date.now(),
    })

    if (isLastStep) {
      get().completeTraining()
    }
  },
  togglePause: (reason) => {
    const { status, currentPauseStart, currentStepIndex, pauses } = get()
    if (status === "active") {
      set({
        status: "paused",
        currentPauseStart: Date.now(),
      })
    } else if (status === "paused" && currentPauseStart) {
      const pauseDuration = Date.now() - currentPauseStart
      const pauseRecord: PauseRecord = {
        stepIndex: currentStepIndex,
        timestamp: currentPauseStart,
        duration: pauseDuration,
        reason,
      }
      set({
        status: "active",
        currentPauseStart: null,
        pauses: [...pauses, pauseRecord],
        stepStartTime: get().stepStartTime + pauseDuration,
      })
    }
  },
  completeTraining: () => {
    const { steps, pauses, startTime } = get()
    const levelPack = useLevelStore.getState().getSelectedLevelPack()
    if (!levelPack) return ""

    const { score, maxScore } = calculateTotalScore(steps)
    const needsManualReview =
      steps.some((s) => s.isBoundaryCase && !s.isCorrect) ||
      pauses.length > 0

    const record = useRecordStore.getState().addRecord({
      levelPackId: levelPack.id,
      levelPackName: levelPack.name,
      startTime,
      endTime: Date.now(),
      totalScore: score,
      maxScore,
      passed: score >= levelPack.passingScore,
      needsManualReview,
      steps,
      pauses,
      source: "系统记录",
    })

    return record.id
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
    })
  },
}))
