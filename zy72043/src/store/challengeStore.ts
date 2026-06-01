import { create } from 'zustand'
import type {
  ChallengeInstance,
  RoundRecord,
  DeductionEntry,
  AuditEntry,
  LevelConfig,
  GameStatus,
} from '@/types'
import { ALL_LEVELS } from '@/data/levels'
import {
  generateId,
  isoNow,
  createRoundRecord,
  createAuditEntries,
  detectDuplicate,
} from '@/engine/challenge'

interface ChallengeStore {
  instance: ChallengeInstance | null
  records: RoundRecord[]
  deductions: DeductionEntry[]
  audits: AuditEntry[]
  level: LevelConfig | null
  timerRef: ReturnType<typeof setInterval> | null

  startChallenge: (levelId: string) => void
  makeChoice: (choice: string) => void
  skipChoice: () => void
  handleTimeout: () => void
  pause: () => void
  resume: () => void
  restart: () => void
  completeChallenge: () => void
  tick: () => void
  loadChallenge: (challengeId: string) => void

  getAllArchived: () => { instance: ChallengeInstance; records: RoundRecord[]; deductions: DeductionEntry[]; audits: AuditEntry[]; level: LevelConfig | null }[]
}

function saveToStorage(
  instance: ChallengeInstance | null,
  records: RoundRecord[],
  deductions: DeductionEntry[],
  audits: AuditEntry[]
) {
  if (!instance) return
  const key = `challenge-${instance.id}`
  localStorage.setItem(
    key,
    JSON.stringify({ instance, records, deductions, audits })
  )
  const index = JSON.parse(localStorage.getItem('challenge-index') || '[]')
  if (!index.includes(instance.id)) {
    index.push(instance.id)
    localStorage.setItem('challenge-index', JSON.stringify(index))
  }
}

function loadFromStorage(challengeId: string) {
  const key = `challenge-${challengeId}`
  const data = localStorage.getItem(key)
  if (!data) return null
  return JSON.parse(data)
}

export const useChallengeStore = create<ChallengeStore>((set, get) => ({
  instance: null,
  records: [],
  deductions: [],
  audits: [],
  level: null,
  timerRef: null,

  startChallenge: (levelId: string) => {
    const level = ALL_LEVELS.find((l) => l.id === levelId)
    if (!level) return

    const instance: ChallengeInstance = {
      id: generateId(),
      levelId,
      status: 'active',
      totalRounds: level.roundCount,
      currentRound: 1,
      elapsedSeconds: 0,
      pausedAt: null,
      createdAt: isoNow(),
      completedAt: null,
      roundTimeLimit: level.roundTimeLimit,
    }

    const audit = createAuditEntries(
      'init',
      '开始挑战',
      'level-config',
      'system',
      { levelId, totalRounds: level.roundCount }
    )

    set({
      instance,
      records: [],
      deductions: [],
      audits: [audit],
      level,
    })

    saveToStorage(instance, [], [], [audit])
  },

  makeChoice: (choice: string) => {
    const { instance, records, level, deductions, audits } = get()
    if (!instance || !level || instance.status !== 'active') return

    const roundNumber = instance.currentRound
    const correctAnswer = level.correctAnswers[roundNumber] || ''
    const isDup = detectDuplicate(records, roundNumber, choice)

    const { record, deductions: newDeductions } = createRoundRecord(
      instance.id,
      roundNumber,
      choice,
      correctAnswer,
      'player',
      isDup,
      level.scoringRules
    )

    const audit = createAuditEntries(
      record.id,
      `第${roundNumber}回合：学员选择 ${choice}`,
      'player-action',
      'player',
      { roundNumber, choice, isDuplicate: isDup }
    )

    const newRecords = [...records, record]
    const newDeductionsAll = [...deductions, ...newDeductions]
    const newAudits = [...audits, audit]

    const isLastRound = roundNumber >= instance.totalRounds
    const updatedInstance: ChallengeInstance = {
      ...instance,
      currentRound: isLastRound ? roundNumber : roundNumber + 1,
      status: isLastRound ? 'completed' : 'active',
      completedAt: isLastRound ? isoNow() : null,
    }

    if (isLastRound) {
      const completeAudit = createAuditEntries(
        'completion',
        '挑战完成',
        'system-auto',
        'system',
        { totalRounds: instance.totalRounds, totalScore: newRecords.reduce((s, r) => s + r.score, 0) / newRecords.length }
      )
      newAudits.push(completeAudit)
    }

    set({
      instance: updatedInstance,
      records: newRecords,
      deductions: newDeductionsAll,
      audits: newAudits,
    })

    saveToStorage(updatedInstance, newRecords, newDeductionsAll, newAudits)
  },

  skipChoice: () => {
    const { instance, records, level, deductions, audits } = get()
    if (!instance || !level || instance.status !== 'active') return

    const roundNumber = instance.currentRound
    const correctAnswer = level.correctAnswers[roundNumber] || ''

    const { record, deductions: newDeductions } = createRoundRecord(
      instance.id,
      roundNumber,
      null,
      correctAnswer,
      'system',
      false,
      level.scoringRules
    )

    const audit = createAuditEntries(
      record.id,
      `第${roundNumber}回合：学员未选择，跳过`,
      'system-auto',
      'system',
      { roundNumber, choice: null, reason: 'skipped' }
    )

    const newRecords = [...records, record]
    const newDeductionsAll = [...deductions, ...newDeductions]
    const newAudits = [...audits, audit]

    const isLastRound = roundNumber >= instance.totalRounds
    const updatedInstance: ChallengeInstance = {
      ...instance,
      currentRound: isLastRound ? roundNumber : roundNumber + 1,
      status: isLastRound ? 'completed' : 'active',
      completedAt: isLastRound ? isoNow() : null,
    }

    set({
      instance: updatedInstance,
      records: newRecords,
      deductions: newDeductionsAll,
      audits: newAudits,
    })

    saveToStorage(updatedInstance, newRecords, newDeductionsAll, newAudits)
  },

  handleTimeout: () => {
    const { instance, records, level, deductions, audits } = get()
    if (!instance || !level || instance.status !== 'active') return

    const roundNumber = instance.currentRound
    const correctAnswer = level.correctAnswers[roundNumber] || ''

    const { record, deductions: newDeductions } = createRoundRecord(
      instance.id,
      roundNumber,
      null,
      correctAnswer,
      'timeout',
      false,
      level.scoringRules
    )

    const audit = createAuditEntries(
      record.id,
      `第${roundNumber}回合：超时未完成`,
      'system-auto',
      'system',
      { roundNumber, elapsedSeconds: instance.elapsedSeconds, reason: 'timeout' }
    )

    const newRecords = [...records, record]
    const newDeductionsAll = [...deductions, ...newDeductions]
    const newAudits = [...audits, audit]

    const isLastRound = roundNumber >= instance.totalRounds
    const updatedInstance: ChallengeInstance = {
      ...instance,
      currentRound: isLastRound ? roundNumber : roundNumber + 1,
      status: isLastRound ? 'completed' : 'active',
      completedAt: isLastRound ? isoNow() : null,
    }

    set({
      instance: updatedInstance,
      records: newRecords,
      deductions: newDeductionsAll,
      audits: newAudits,
    })

    saveToStorage(updatedInstance, newRecords, newDeductionsAll, newAudits)
  },

  pause: () => {
    const { instance, records, deductions, audits } = get()
    if (!instance || instance.status !== 'active') return

    const updatedInstance: ChallengeInstance = {
      ...instance,
      status: 'paused' as GameStatus,
      pausedAt: isoNow(),
    }

    const audit = createAuditEntries(
      'pause',
      '挑战暂停',
      'player-action',
      'player',
      { pausedAt: updatedInstance.pausedAt, currentRound: instance.currentRound }
    )

    set({
      instance: updatedInstance,
      audits: [...audits, audit],
    })

    saveToStorage(updatedInstance, records, deductions, [...audits, audit])
  },

  resume: () => {
    const { instance, records, deductions, audits } = get()
    if (!instance || instance.status !== 'paused') return

    const updatedInstance: ChallengeInstance = {
      ...instance,
      status: 'active' as GameStatus,
      pausedAt: null,
    }

    const audit = createAuditEntries(
      'resume',
      '挑战继续',
      'player-action',
      'player',
      { resumedAt: isoNow(), currentRound: instance.currentRound }
    )

    set({
      instance: updatedInstance,
      audits: [...audits, audit],
    })

    saveToStorage(updatedInstance, records, deductions, [...audits, audit])
  },

  restart: () => {
    const { instance, level } = get()
    if (!instance || !level) return

    const archivedInstance: ChallengeInstance = {
      ...instance,
      status: 'abandoned' as GameStatus,
      completedAt: isoNow(),
    }
    saveToStorage(archivedInstance, get().records, get().deductions, get().audits)

    get().startChallenge(level.id)
  },

  completeChallenge: () => {
    const { instance, records, deductions, audits } = get()
    if (!instance) return

    const updatedInstance: ChallengeInstance = {
      ...instance,
      status: 'completed' as GameStatus,
      completedAt: isoNow(),
    }

    const audit = createAuditEntries(
      'completion',
      '挑战完成',
      'system-auto',
      'system',
      { totalRounds: instance.totalRounds }
    )

    set({
      instance: updatedInstance,
      audits: [...audits, audit],
    })

    saveToStorage(updatedInstance, records, deductions, [...audits, audit])
  },

  tick: () => {
    const { instance, records, deductions, audits } = get()
    if (!instance || instance.status !== 'active') return

    const updatedInstance: ChallengeInstance = {
      ...instance,
      elapsedSeconds: instance.elapsedSeconds + 1,
    }

    set({ instance: updatedInstance })
    saveToStorage(updatedInstance, records, deductions, audits)
  },

  loadChallenge: (challengeId: string) => {
    const data = loadFromStorage(challengeId)
    if (!data) return

    const level = ALL_LEVELS.find((l) => l.id === data.instance.levelId) || null
    set({
      instance: data.instance,
      records: data.records,
      deductions: data.deductions,
      audits: data.audits,
      level,
    })
  },

  getAllArchived: () => {
    const index: string[] = JSON.parse(
      localStorage.getItem('challenge-index') || '[]'
    )
    return index
      .map((id) => {
        const data = loadFromStorage(id)
        if (!data) return null
        const level = ALL_LEVELS.find((l) => l.id === data.instance.levelId) || null
        return {
          instance: data.instance as ChallengeInstance,
          records: data.records as RoundRecord[],
          deductions: data.deductions as DeductionEntry[],
          audits: data.audits as AuditEntry[],
          level,
        }
      })
      .filter(Boolean) as { instance: ChallengeInstance; records: RoundRecord[]; deductions: DeductionEntry[]; audits: AuditEntry[]; level: LevelConfig | null }[]
  },
}))
