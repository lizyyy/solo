import { create } from 'zustand'
import type {
  DicePhase,
  DiceStateModel,
  ProbabilityBoard,
  OperationSnapshot,
  FailureFeedback,
  DirtyDataMark,
  GameRecord,
  StudentData,
  LevelType,
  ErrorCategory,
  AnomalyType,
  OperationType,
  UserRole,
} from '@/types'
import {
  LEVEL_CONFIGS,
  FAIR_DICE_PROBABILITY,
  SAMPLE_SIZES,
  TEACHER_CODE,
  ANOMALY_DESCRIPTIONS,
  ERROR_DESCRIPTIONS,
} from '@/utils/constants'
import {
  generateId,
  rollMultipleDice,
  computeExperimentalProbabilities,
  checkNormalization,
  computeStatistics,
} from '@/utils/helpers'

interface GameState {
  currentUser: { name: string; role: UserRole } | null
  currentLevelId: string | null
  diceState: DiceStateModel
  probabilityBoard: ProbabilityBoard
  sampleSize: number
  operationHistory: OperationSnapshot[]
  currentRecord: GameRecord | null
  failureFeedback: FailureFeedback | null
  dirtyDataMarks: DirtyDataMark[]
  allStudents: StudentData[]
  showFailurePanel: boolean
  showReplay: boolean
  replaySnapshotId: string | null

  login: (name: string, role: UserRole, teacherCode?: string) => boolean
  logout: () => void
  enterLevel: (levelId: string) => void
  rollDice: () => void
  measureDice: () => void
  changeSampleSize: (size: number) => void
  resetSample: () => void
  submitAnswer: (answer: string) => void
  dismissFailure: () => void
  openReplay: (snapshotId: string) => void
  closeReplay: () => void
  confirmDirtyData: (markId: string) => void
  exitLevel: () => void
  getStudentRecords: (name: string) => GameRecord[]
  getAllDirtyMarks: () => DirtyDataMark[]
}

function createInitialDiceState(): DiceStateModel {
  return {
    phase: 'superposition',
    probabilities: [...FAIR_DICE_PROBABILITY],
    collapsedValue: null,
    measurementCount: 0,
    isRepeatedMeasurement: false,
  }
}

function createInitialProbabilityBoard(): ProbabilityBoard {
  return {
    theoretical: [...FAIR_DICE_PROBABILITY],
    experimental: Array(6).fill(0),
    totalRolls: 0,
    faceCounts: Array(6).fill(0),
    isNormalized: true,
    normalizationError: null,
  }
}

function detectAnomaly(
  diceState: DiceStateModel,
  probabilityBoard: ProbabilityBoard,
  operationType: OperationType,
): { isAnomaly: boolean; anomalyType: AnomalyType | null } {
  const { isNormalized, sum } = checkNormalization(probabilityBoard.experimental)
  if (!isNormalized && probabilityBoard.totalRolls > 0) {
    return { isAnomaly: true, anomalyType: 'unnormalized_probability' }
  }
  if (operationType === 'measure' && diceState.phase === 'collapsed' && diceState.measurementCount > 3) {
    return { isAnomaly: true, anomalyType: 'repeated_measurement' }
  }
  return { isAnomaly: false, anomalyType: null }
}

function diagnoseError(
  levelType: LevelType,
  answer: string,
  correctAnswer: string,
  diceState: DiceStateModel,
  probabilityBoard: ProbabilityBoard,
): { category: ErrorCategory; description: string } {
  if (answer === correctAnswer) return { category: 'concept', description: '' }

  if (levelType === 'superposition') {
    if (answer !== '不确定') {
      return { category: 'concept', description: ERROR_DESCRIPTIONS.concept_superposition }
    }
  }

  if (levelType === 'measurement') {
    if (answer === '会变') {
      return { category: 'concept', description: ERROR_DESCRIPTIONS.concept_collapse_irreversible }
    }
    if (answer === '不确定' && diceState.measurementCount >= 2) {
      return { category: 'operation', description: ERROR_DESCRIPTIONS.operation_ignored_board }
    }
  }

  if (levelType === 'bias') {
    const chosenSize = parseInt(answer)
    if (chosenSize < 1000) {
      if (chosenSize <= 10) {
        return { category: 'concept', description: ERROR_DESCRIPTIONS.concept_law_of_large_numbers }
      }
      if (probabilityBoard.totalRolls > 0) {
        return { category: 'operation', description: ERROR_DESCRIPTIONS.operation_ignored_board }
      }
      return { category: 'concept', description: ERROR_DESCRIPTIONS.concept_law_of_large_numbers }
    }
  }

  return { category: 'concept', description: '回答不正确，请再想想' }
}

function loadStudents(): StudentData[] {
  try {
    const data = localStorage.getItem('quantum-dice-students')
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

function saveStudents(students: StudentData[]) {
  localStorage.setItem('quantum-dice-students', JSON.stringify(students))
}

function loadDirtyMarks(): DirtyDataMark[] {
  try {
    const data = localStorage.getItem('quantum-dice-dirty-marks')
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

function saveDirtyMarks(marks: DirtyDataMark[]) {
  localStorage.setItem('quantum-dice-dirty-marks', JSON.stringify(marks))
}

export const useGameStore = create<GameState>((set, get) => ({
  currentUser: null,
  currentLevelId: null,
  diceState: createInitialDiceState(),
  probabilityBoard: createInitialProbabilityBoard(),
  sampleSize: 1,
  operationHistory: [],
  currentRecord: null,
  failureFeedback: null,
  dirtyDataMarks: loadDirtyMarks(),
  allStudents: loadStudents(),
  showFailurePanel: false,
  showReplay: false,
  replaySnapshotId: null,

  login: (name, role, teacherCode) => {
    if (role === 'teacher' && teacherCode !== TEACHER_CODE) return false
    const user = { name, role }
    const students = get().allStudents
    if (role === 'student' && !students.find(s => s.name === name)) {
      const newStudent: StudentData = { name, role, createdAt: Date.now(), records: [] }
      const updated = [...students, newStudent]
      saveStudents(updated)
      set({ currentUser: user, allStudents: updated })
    } else {
      set({ currentUser: user })
    }
    return true
  },

  logout: () => {
    set({ currentUser: null, currentLevelId: null, currentRecord: null })
  },

  enterLevel: (levelId) => {
    const state = get()
    const config = LEVEL_CONFIGS.find(l => l.id === levelId)
    if (!config) return

    const record: GameRecord = {
      id: generateId(),
      studentName: state.currentUser?.name || '',
      levelId,
      attemptCount: 0,
      stars: 0,
      passed: false,
      startedAt: Date.now(),
      completedAt: null,
      snapshots: [],
      feedbacks: [],
    }

    set({
      currentLevelId: levelId,
      diceState: createInitialDiceState(),
      probabilityBoard: createInitialProbabilityBoard(),
      sampleSize: 1,
      operationHistory: [],
      currentRecord: record,
      failureFeedback: null,
      showFailurePanel: false,
      showReplay: false,
      replaySnapshotId: null,
    })
  },

  rollDice: () => {
    const state = get()
    const size = state.sampleSize
    const results = rollMultipleDice(size)
    const newFaceCounts = [...state.probabilityBoard.faceCounts]

    for (const r of results) {
      newFaceCounts[r]++
    }

    const newTotalRolls = state.probabilityBoard.totalRolls + size
    const newExperimental = computeExperimentalProbabilities(newFaceCounts, newTotalRolls)
    const normCheck = checkNormalization(newExperimental)

    const newBoard: ProbabilityBoard = {
      theoretical: [...FAIR_DICE_PROBABILITY],
      experimental: newExperimental,
      totalRolls: newTotalRolls,
      faceCounts: newFaceCounts,
      isNormalized: normCheck.isNormalized,
      normalizationError: normCheck.isNormalized ? null : `概率未归一（总和=${normCheck.sum.toFixed(4)}）`,
    }

    const newDice: DiceStateModel = {
      ...state.diceState,
      phase: 'superposition' as DicePhase,
    }

    const snapshot: OperationSnapshot = {
      id: generateId(),
      timestamp: Date.now(),
      operationType: 'roll',
      diceState: { ...newDice },
      probabilityBoard: { ...newBoard },
      sampleSize: size,
      isAnomaly: false,
      anomalyType: null,
    }

    const anomaly = detectAnomaly(newDice, newBoard, 'roll')
    snapshot.isAnomaly = anomaly.isAnomaly
    snapshot.anomalyType = anomaly.anomalyType

    let newDirtyMarks = [...state.dirtyDataMarks]
    if (anomaly.isAnomaly && anomaly.anomalyType) {
      const mark: DirtyDataMark = {
        id: generateId(),
        snapshotId: snapshot.id,
        anomalyType: anomaly.anomalyType,
        description: ANOMALY_DESCRIPTIONS[anomaly.anomalyType],
        manuallyConfirmed: false,
        markedAt: Date.now(),
        confirmedAt: null,
        historyTrail: [`创建: ${new Date().toISOString()} - ${ANOMALY_DESCRIPTIONS[anomaly.anomalyType]}`],
      }
      newDirtyMarks = [...newDirtyMarks, mark]
      saveDirtyMarks(newDirtyMarks)
    }

    const history = [...state.operationHistory, snapshot]
    const record = state.currentRecord
      ? { ...state.currentRecord, snapshots: [...state.currentRecord.snapshots, snapshot] }
      : null

    set({
      diceState: newDice,
      probabilityBoard: newBoard,
      operationHistory: history,
      currentRecord: record,
      dirtyDataMarks: newDirtyMarks,
    })
  },

  measureDice: () => {
    const state = get()
    const prevDice = { ...state.diceState }

    if (prevDice.phase === 'collapsed') {
      const newMeasurementCount = prevDice.measurementCount + 1
      const isRepeated = newMeasurementCount > 1

      const newDice: DiceStateModel = {
        ...prevDice,
        measurementCount: newMeasurementCount,
        isRepeatedMeasurement: isRepeated,
      }

      const snapshot: OperationSnapshot = {
        id: generateId(),
        timestamp: Date.now(),
        operationType: 'measure',
        diceState: { ...newDice },
        probabilityBoard: { ...state.probabilityBoard },
        sampleSize: state.sampleSize,
        isAnomaly: newMeasurementCount > 3,
        anomalyType: newMeasurementCount > 3 ? 'repeated_measurement' : null,
      }

      let newDirtyMarks = [...state.dirtyDataMarks]
      if (newMeasurementCount > 3) {
        const mark: DirtyDataMark = {
          id: generateId(),
          snapshotId: snapshot.id,
          anomalyType: 'repeated_measurement',
          description: `重复测量${newMeasurementCount}次`,
          manuallyConfirmed: false,
          markedAt: Date.now(),
          confirmedAt: null,
          historyTrail: [`创建: ${new Date().toISOString()} - 重复测量${newMeasurementCount}次`],
        }
        newDirtyMarks = [...newDirtyMarks, mark]
        saveDirtyMarks(newDirtyMarks)
      }

      const history = [...state.operationHistory, snapshot]
      const record = state.currentRecord
        ? { ...state.currentRecord, snapshots: [...state.currentRecord.snapshots, snapshot] }
        : null

      set({
        diceState: newDice,
        operationHistory: history,
        currentRecord: record,
        dirtyDataMarks: newDirtyMarks,
      })
      return
    }

    const collapsedValue = Math.floor(Math.random() * 6)
    const newDice: DiceStateModel = {
      phase: 'collapsed',
      probabilities: Array(6).fill(0).map((_, i) => i === collapsedValue ? 1 : 0),
      collapsedValue,
      measurementCount: 1,
      isRepeatedMeasurement: false,
    }

    const snapshot: OperationSnapshot = {
      id: generateId(),
      timestamp: Date.now(),
      operationType: 'measure',
      diceState: { ...newDice },
      probabilityBoard: { ...state.probabilityBoard },
      sampleSize: state.sampleSize,
      isAnomaly: false,
      anomalyType: null,
    }

    const history = [...state.operationHistory, snapshot]
    const record = state.currentRecord
      ? { ...state.currentRecord, snapshots: [...state.currentRecord.snapshots, snapshot] }
      : null

    set({
      diceState: newDice,
      operationHistory: history,
      currentRecord: record,
    })
  },

  changeSampleSize: (size) => {
    const state = get()
    const snapshot: OperationSnapshot = {
      id: generateId(),
      timestamp: Date.now(),
      operationType: 'change_sample',
      diceState: { ...state.diceState },
      probabilityBoard: { ...state.probabilityBoard },
      sampleSize: size,
      isAnomaly: false,
      anomalyType: null,
    }
    set({
      sampleSize: size,
      operationHistory: [...state.operationHistory, snapshot],
    })
  },

  resetSample: () => {
    const state = get()
    const prevBoard = { ...state.probabilityBoard }

    const newBoard: ProbabilityBoard = {
      theoretical: [...FAIR_DICE_PROBABILITY],
      experimental: Array(6).fill(0),
      totalRolls: 0,
      faceCounts: Array(6).fill(0),
      isNormalized: true,
      normalizationError: null,
    }

    const hasResetError = prevBoard.totalRolls > 0 && prevBoard.faceCounts.some(c => c > 0)

    const snapshot: OperationSnapshot = {
      id: generateId(),
      timestamp: Date.now(),
      operationType: 'reset_sample',
      diceState: { ...state.diceState },
      probabilityBoard: { ...newBoard },
      sampleSize: state.sampleSize,
      isAnomaly: false,
      anomalyType: null,
    }

    let newDirtyMarks = [...state.dirtyDataMarks]
    if (hasResetError) {
      snapshot.isAnomaly = true
      snapshot.anomalyType = 'sample_reset_error'
      const mark: DirtyDataMark = {
        id: generateId(),
        snapshotId: snapshot.id,
        anomalyType: 'sample_reset_error',
        description: '样本清零操作：清零前存在累计数据',
        manuallyConfirmed: false,
        markedAt: Date.now(),
        confirmedAt: null,
        historyTrail: [
          `创建: ${new Date().toISOString()} - 清零前总投掷${prevBoard.totalRolls}次`,
          `清零前面计数: [${prevBoard.faceCounts.join(',')}]`,
        ],
      }
      newDirtyMarks = [...newDirtyMarks, mark]
      saveDirtyMarks(newDirtyMarks)
    }

    const history = [...state.operationHistory, snapshot]
    const record = state.currentRecord
      ? { ...state.currentRecord, snapshots: [...state.currentRecord.snapshots, snapshot] }
      : null

    set({
      probabilityBoard: newBoard,
      operationHistory: history,
      currentRecord: record,
      dirtyDataMarks: newDirtyMarks,
    })
  },

  submitAnswer: (answer) => {
    const state = get()
    if (!state.currentLevelId || !state.currentRecord) return

    const config = LEVEL_CONFIGS.find(l => l.id === state.currentLevelId)
    if (!config) return

    const isCorrect = answer === config.correctAnswer
    const newAttemptCount = state.currentRecord.attemptCount + 1

    const snapshot: OperationSnapshot = {
      id: generateId(),
      timestamp: Date.now(),
      operationType: 'submit_answer',
      diceState: { ...state.diceState },
      probabilityBoard: { ...state.probabilityBoard },
      sampleSize: state.sampleSize,
      isAnomaly: false,
      anomalyType: null,
      answer,
    }

    const history = [...state.operationHistory, snapshot]

    if (isCorrect) {
      let stars = 1
      if (newAttemptCount === 1) stars = 3
      else if (newAttemptCount <= 2) stars = 2

      const updatedRecord: GameRecord = {
        ...state.currentRecord,
        attemptCount: newAttemptCount,
        stars,
        passed: true,
        completedAt: Date.now(),
        snapshots: [...state.currentRecord.snapshots, snapshot],
      }

      const students = [...state.allStudents]
      const studentIdx = students.findIndex(s => s.name === state.currentUser?.name)
      if (studentIdx >= 0) {
        const existingRecordIdx = students[studentIdx].records.findIndex(
          r => r.levelId === state.currentLevelId && r.passed
        )
        if (existingRecordIdx >= 0) {
          if (stars > students[studentIdx].records[existingRecordIdx].stars) {
            students[studentIdx].records[existingRecordIdx] = updatedRecord
          }
        } else {
          students[studentIdx].records.push(updatedRecord)
        }
        saveStudents(students)
      }

      set({
        currentRecord: updatedRecord,
        allStudents: students,
        operationHistory: history,
        failureFeedback: null,
        showFailurePanel: false,
      })
    } else {
      const diagnosis = diagnoseError(
        config.type,
        answer,
        config.correctAnswer,
        state.diceState,
        state.probabilityBoard,
      )

      const stats = computeStatistics(
        state.probabilityBoard.faceCounts,
        state.probabilityBoard.totalRolls,
      )

      const feedback: FailureFeedback = {
        id: generateId(),
        recordId: state.currentRecord.id,
        errorCategory: diagnosis.category,
        errorDescription: diagnosis.description,
        probabilityUpdateStatus: {
          before: [...state.probabilityBoard.experimental],
          after: [...state.probabilityBoard.experimental],
          delta: Array(6).fill(0),
        },
        measurementState: {
          collapsed: state.diceState.phase === 'collapsed',
          repeatedCount: state.diceState.measurementCount,
        },
        sampleStatistics: {
          size: state.probabilityBoard.totalRolls,
          mean: stats.mean,
          variance: stats.variance,
        },
        replaySnapshotId: snapshot.id,
      }

      const updatedRecord: GameRecord = {
        ...state.currentRecord,
        attemptCount: newAttemptCount,
        snapshots: [...state.currentRecord.snapshots, snapshot],
        feedbacks: [...state.currentRecord.feedbacks, feedback],
      }

      set({
        currentRecord: updatedRecord,
        operationHistory: history,
        failureFeedback: feedback,
        showFailurePanel: true,
      })
    }
  },

  dismissFailure: () => {
    set({ showFailurePanel: false })
  },

  openReplay: (snapshotId) => {
    set({ showReplay: true, replaySnapshotId: snapshotId })
  },

  closeReplay: () => {
    set({ showReplay: false, replaySnapshotId: null })
  },

  confirmDirtyData: (markId) => {
    const state = get()
    const newMarks = state.dirtyDataMarks.map(m => {
      if (m.id === markId && !m.manuallyConfirmed) {
        return {
          ...m,
          manuallyConfirmed: true,
          confirmedAt: Date.now(),
          historyTrail: [
            ...m.historyTrail,
            `人工确认: ${new Date().toISOString()} - 教师确认此异常标记`,
          ],
        }
      }
      return m
    })
    saveDirtyMarks(newMarks)
    set({ dirtyDataMarks: newMarks })
  },

  exitLevel: () => {
    set({
      currentLevelId: null,
      currentRecord: null,
      diceState: createInitialDiceState(),
      probabilityBoard: createInitialProbabilityBoard(),
      sampleSize: 1,
      operationHistory: [],
      failureFeedback: null,
      showFailurePanel: false,
      showReplay: false,
      replaySnapshotId: null,
    })
  },

  getStudentRecords: (name) => {
    const student = get().allStudents.find(s => s.name === name)
    return student?.records || []
  },

  getAllDirtyMarks: () => {
    return get().dirtyDataMarks
  },
}))
