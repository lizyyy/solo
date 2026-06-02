import { create } from 'zustand'
import type { GameState, OperationLog, Material, GameSlot, PauseRecord, SupplementNote, FloatingMessage, FailureReason } from '@/types'
import { mockMaterialPack, presetMistakeOperations, presetPauseRecord } from '@/data/mockMaterials'
import { validatePlacement, diagnoseFailure, isGameComplete, hasMisplacedMaterials, generateKeyDecisions } from '@/game/engine'

function generateId(): string {
  return Math.random().toString(36).substring(2, 11)
}

function createInitialState(): GameState {
  return {
    sessionId: generateId(),
    status: 'idle',
    score: 0,
    resource: 10,
    risk: 0,
    riskThreshold: 50,
    timeRemaining: 300,
    totalTime: 300,
    materials: [...mockMaterialPack.materials],
    slots: [...mockMaterialPack.slots],
    placedMaterials: {},
    operationLogs: [],
    pauseRecords: [],
    supplementNotes: [],
    materialPack: mockMaterialPack,
    studentName: '',
    startTime: new Date().toISOString(),
  }
}

interface GameStore extends GameState {
  floatingMessages: FloatingMessage[]
  setStudentName: (name: string) => void
  startGame: (usePresetScenarios?: boolean) => void
  pauseGame: (reason?: string, isIntentional?: boolean) => void
  resumeGame: () => void
  placeMaterial: (materialId: string, slotId: string, clientX?: number, clientY?: number) => void
  removeMaterial: (materialId: string) => void
  clickMaterial: (materialId: string, clientX?: number, clientY?: number) => void
  addFloatingMessage: (message: Omit<FloatingMessage, 'id'>) => void
  removeFloatingMessage: (id: string) => void
  addSupplementNote: (operationId: string | undefined, content: string, addedBy: string) => void
  tick: () => void
  resetGame: () => void
  loadState: (state: Partial<GameState>) => void
  finishGame: (reason?: FailureReason) => void
  getGameResult: () => any
}

export const useGameStore = create<GameStore>((set, get) => ({
  ...createInitialState(),
  floatingMessages: [],

  setStudentName: (name) => set({ studentName: name }),

  startGame: (usePresetScenarios = false) => {
    const baseState = createInitialState()
    const operationLogs: OperationLog[] = []
    const pauseRecords: PauseRecord[] = []

    if (usePresetScenarios) {
      presetMistakeOperations.forEach(op => {
        operationLogs.push({
          ...op,
          id: generateId(),
        })
      })
      pauseRecords.push({
        ...presetPauseRecord,
        id: generateId(),
        resumeTime: new Date(Date.now() - 120000).toISOString(),
      })
    }

    set({
      ...baseState,
      status: 'playing',
      startTime: new Date().toISOString(),
      operationLogs,
      pauseRecords,
      score: operationLogs.reduce((sum, op) => sum + (op.scoreDelta || 0), 0),
      risk: operationLogs.reduce((sum, op) => sum + (op.riskDelta || 0), 0),
      resource: 10 + operationLogs.reduce((sum, op) => sum + (op.resourceDelta || 0), 0),
    })
  },

  pauseGame: (reason = '手动暂停', isIntentional = false) => {
    const state = get()
    if (state.status !== 'playing') return

    const pauseRecord: PauseRecord = {
      id: generateId(),
      pauseTime: new Date().toISOString(),
      reason,
      isIntentional,
    }

    set({
      status: 'paused',
      pauseRecords: [...state.pauseRecords, pauseRecord],
    })
  },

  resumeGame: () => {
    const state = get()
    if (state.status !== 'paused') return

    const updatedPauses = state.pauseRecords.map((p, idx) => {
      if (idx === state.pauseRecords.length - 1 && !p.resumeTime) {
        return { ...p, resumeTime: new Date().toISOString() }
      }
      return p
    })

    set({
      status: 'playing',
      pauseRecords: updatedPauses,
    })
  },

  placeMaterial: (materialId, slotId, clientX, clientY) => {
    const state = get()
    if (state.status !== 'playing') return

    const material = state.materials.find(m => m.id === materialId)
    const slot = state.slots.find(s => s.id === slotId)
    if (!material || !slot) return

    if (state.placedMaterials[materialId]) {
      delete state.placedMaterials[materialId]
    }

    const result = validatePlacement(material, slot, state.placedMaterials)
    const newPlacedMaterials = { ...state.placedMaterials, [materialId]: slotId }

    const log: OperationLog = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      operationType: 'place',
      materialId,
      targetSlot: slotId,
      isCorrect: result.isCorrect,
      rawNote: result.rawNote || material.originalNote,
      scoreDelta: result.scoreDelta,
      riskDelta: result.riskDelta,
      resourceDelta: result.resourceDelta,
    }

    const newScore = Math.max(0, state.score + result.scoreDelta)
    const newRisk = Math.max(0, state.risk + result.riskDelta)
    const newResource = Math.max(0, state.resource + result.resourceDelta)

    const msgType = result.isCorrect ? 'success' : result.scoreDelta >= 0 ? 'warning' : 'error'
    const msgText = `${result.scoreDelta >= 0 ? '+' : ''}${result.scoreDelta}分`
    
    if (clientX && clientY) {
      get().addFloatingMessage({ text: msgText, type: msgType, x: clientX, y: clientY })
    }

    set({
      placedMaterials: newPlacedMaterials,
      operationLogs: [...state.operationLogs, log],
      score: newScore,
      risk: newRisk,
      resource: newResource,
    })

    const updatedState = get()

    if (newRisk >= state.riskThreshold) {
      get().finishGame('rule_misunderstanding')
    } else if (isGameComplete(updatedState)) {
      get().finishGame()
    } else if (Object.keys(updatedState.placedMaterials).length === updatedState.materials.length && hasMisplacedMaterials(updatedState)) {
      get().finishGame('rule_misunderstanding')
    }
  },

  removeMaterial: (materialId) => {
    const state = get()
    if (state.status !== 'playing') return
    if (!state.placedMaterials[materialId]) return

    const newPlacedMaterials = { ...state.placedMaterials }
    delete newPlacedMaterials[materialId]

    const log: OperationLog = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      operationType: 'remove',
      materialId,
      scoreDelta: -1,
      riskDelta: 1,
      resourceDelta: 0,
    }

    set({
      placedMaterials: newPlacedMaterials,
      operationLogs: [...state.operationLogs, log],
      score: Math.max(0, state.score - 1),
      risk: state.risk + 1,
    })
  },

  clickMaterial: (materialId, clientX, clientY) => {
    const state = get()
    if (state.status !== 'playing') return

    const material = state.materials.find(m => m.id === materialId)
    if (!material) return

    const clickCount = state.operationLogs.filter(
      op => op.materialId === materialId && op.operationType === 'click'
    ).length

    const log: OperationLog = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      operationType: 'click',
      materialId,
      rawNote: material.originalNote,
      scoreDelta: 0,
      riskDelta: clickCount >= 3 ? 1 : 0,
      resourceDelta: clickCount >= 2 ? -1 : 0,
    }

    if (clientX && clientY && clickCount >= 2) {
      get().addFloatingMessage({ text: '-1资源', type: 'warning', x: clientX, y: clientY })
    }

    set({
      operationLogs: [...state.operationLogs, log],
      risk: state.risk + (clickCount >= 3 ? 1 : 0),
      resource: Math.max(0, state.resource + (clickCount >= 2 ? -1 : 0)),
    })
  },

  addFloatingMessage: (message) => {
    const id = generateId()
    set({
      floatingMessages: [...get().floatingMessages, { ...message, id }],
    })
    setTimeout(() => {
      get().removeFloatingMessage(id)
    }, 1000)
  },

  removeFloatingMessage: (id) => {
    set({
      floatingMessages: get().floatingMessages.filter(m => m.id !== id),
    })
  },

  addSupplementNote: (operationId, content, addedBy) => {
    const note: SupplementNote = {
      id: generateId(),
      operationId,
      content,
      addedAt: new Date().toISOString(),
      addedBy,
    }
    set({
      supplementNotes: [...get().supplementNotes, note],
    })
  },

  tick: () => {
    const state = get()
    if (state.status !== 'playing') return

    const newTime = state.timeRemaining - 1
    set({ timeRemaining: newTime })

    if (newTime <= 0) {
      get().finishGame('timeout')
    }
  },

  resetGame: () => {
    set({
      ...createInitialState(),
      floatingMessages: [],
    })
  },

  loadState: (partialState) => {
    set(partialState)
  },

  finishGame: (reason) => {
    const state = get()
    if (state.status === 'completed' || state.status === 'failed') return

    const diagnosis = diagnoseFailure(state)
    const finalReason = reason || diagnosis.reason
    const finalDetails = diagnosis.details

    const status: 'completed' | 'failed' = reason ? 'failed' : 'completed'

    set({
      status,
      endTime: new Date().toISOString(),
      failureReason: status === 'failed' ? finalReason : undefined,
      diagnosticDetails: status === 'completed' ? ['所有材料已正确匹配至对应槽位'] : finalDetails,
    })
  },

  getGameResult: () => {
    const state = get()
    const keyDecisions = generateKeyDecisions(state)

    return {
      sessionId: state.sessionId,
      status: state.status === 'completed' ? 'completed' : 'failed',
      failureReason: state.failureReason,
      finalScore: state.score,
      finalResource: state.resource,
      finalRisk: state.risk,
      diagnosticDetails: state.diagnosticDetails || [],
      exportMetadata: {
        exportedAt: new Date().toISOString(),
        materialSource: state.materialPack.source,
        processingStartTime: state.startTime,
        processingEndTime: state.endTime || new Date().toISOString(),
        keyDecisions,
        handler: '科普馆讲解员-小夏',
      },
      operationLogs: state.operationLogs,
      pauseRecords: state.pauseRecords,
      supplementNotes: state.supplementNotes,
      placedMaterials: state.placedMaterials,
      materialPack: state.materialPack,
      studentName: state.studentName,
    }
  },
}))
