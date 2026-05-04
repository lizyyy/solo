import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  Session,
  Horse,
  VetRecord,
  ShoeingRecord,
  TackItem,
  RaceEntry,
  Risk,
  ReviewRecord,
  AppSettings,
  ImportLog,
} from '@/types'
import { defaultSettings } from '@/types'
import {
  getAllSessions,
  createSession as dbCreateSession,
  getSession,
  updateSession as dbUpdateSession,
  getSessionData,
  saveSessionData,
  saveRisks,
  saveReviewRecords,
  getSettings as dbGetSettings,
  saveSettings as dbSaveSettings,
  saveImportLog,
  getImportLogs,
} from '@/database'

export const useAppStore = defineStore('app', () => {
  const sessions = ref<Session[]>([])
  const currentSessionId = ref<string | null>(null)
  const currentSession = ref<Session | null>(null)
  
  const sessionData = ref<{
    horses: Horse[]
    vetRecords: VetRecord[]
    shoeingRecords: ShoeingRecord[]
    tackItems: TackItem[]
    raceEntries: RaceEntry[]
    risks: Risk[]
    reviewRecords: ReviewRecord[]
  }>({
    horses: [],
    vetRecords: [],
    shoeingRecords: [],
    tackItems: [],
    raceEntries: [],
    risks: [],
    reviewRecords: [],
  })

  const settings = ref<AppSettings>({ ...defaultSettings })
  const importLogs = ref<ImportLog[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const hasCriticalUnresolved = computed(() => {
    return sessionData.value.risks.some(risk => {
      if (risk.severity !== 'critical') return false
      const review = sessionData.value.reviewRecords.find(r => r.riskId === risk.id)
      return !review || review.coachJudgment !== 'overruled'
    })
  })

  const risksByType = computed(() => {
    const grouped: Record<string, Risk[]> = {}
    for (const risk of sessionData.value.risks) {
      if (!grouped[risk.type]) {
        grouped[risk.type] = []
      }
      grouped[risk.type].push(risk)
    }
    return grouped
  })

  const risksBySeverity = computed(() => {
    return {
      critical: sessionData.value.risks.filter(r => r.severity === 'critical').length,
      high: sessionData.value.risks.filter(r => r.severity === 'high').length,
      medium: sessionData.value.risks.filter(r => r.severity === 'medium').length,
      low: sessionData.value.risks.filter(r => r.severity === 'low').length,
    }
  })

  const reviewStats = computed(() => {
    const reviewed = sessionData.value.reviewRecords
    return {
      total: sessionData.value.risks.length,
      confirmed: reviewed.filter(r => r.coachJudgment === 'confirmed').length,
      overruled: reviewed.filter(r => r.coachJudgment === 'overruled').length,
      pending: reviewed.filter(r => r.coachJudgment === 'pending').length + 
               (sessionData.value.risks.length - reviewed.length),
    }
  })

  async function loadSessions(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      sessions.value = await getAllSessions()
    } catch (err) {
      error.value = (err as Error).message
    } finally {
      loading.value = false
    }
  }

  async function createNewSession(
    data: Omit<Session, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Session> {
    loading.value = true
    error.value = null
    try {
      const session = await dbCreateSession(data)
      sessions.value.unshift(session)
      currentSessionId.value = session.id
      currentSession.value = session
      resetSessionData()
      return session
    } catch (err) {
      error.value = (err as Error).message
      throw err
    } finally {
      loading.value = false
    }
  }

  async function selectSession(sessionId: string): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const session = await getSession(sessionId)
      if (session) {
        currentSessionId.value = sessionId
        currentSession.value = session
        await loadCurrentSessionData()
      }
    } catch (err) {
      error.value = (err as Error).message
    } finally {
      loading.value = false
    }
  }

  async function loadCurrentSessionData(): Promise<void> {
    if (!currentSessionId.value) return

    loading.value = true
    error.value = null
    try {
      sessionData.value = await getSessionData(currentSessionId.value)
      importLogs.value = await getImportLogs(currentSessionId.value)
    } catch (err) {
      error.value = (err as Error).message
    } finally {
      loading.value = false
    }
  }

  function resetSessionData(): void {
    sessionData.value = {
      horses: [],
      vetRecords: [],
      shoeingRecords: [],
      tackItems: [],
      raceEntries: [],
      risks: [],
      reviewRecords: [],
    }
    importLogs.value = []
  }

  async function updateCurrentSessionStatus(status: Session['status']): Promise<void> {
    if (!currentSessionId.value) return
    await dbUpdateSession(currentSessionId.value, { status })
    if (currentSession.value) {
      currentSession.value.status = status
    }
  }

  async function saveHorses(horses: Horse[]): Promise<void> {
    if (!currentSessionId.value) return
    sessionData.value.horses = horses
    await saveSessionData(currentSessionId.value, { horses })
  }

  async function saveVetRecords(records: VetRecord[]): Promise<void> {
    if (!currentSessionId.value) return
    sessionData.value.vetRecords = records
    await saveSessionData(currentSessionId.value, { vetRecords: records })
  }

  async function saveShoeingRecords(records: ShoeingRecord[]): Promise<void> {
    if (!currentSessionId.value) return
    sessionData.value.shoeingRecords = records
    await saveSessionData(currentSessionId.value, { shoeingRecords: records })
  }

  async function saveTackItems(items: TackItem[]): Promise<void> {
    if (!currentSessionId.value) return
    sessionData.value.tackItems = items
    await saveSessionData(currentSessionId.value, { tackItems: items })
  }

  async function saveRaceEntries(entries: RaceEntry[]): Promise<void> {
    if (!currentSessionId.value) return
    sessionData.value.raceEntries = entries
    await saveSessionData(currentSessionId.value, { raceEntries: entries })
  }

  async function saveCurrentRisks(risks: Risk[]): Promise<void> {
    if (!currentSessionId.value) return
    sessionData.value.risks = risks
    await saveRisks(currentSessionId.value, risks)
  }

  async function saveCurrentReviewRecords(records: ReviewRecord[]): Promise<void> {
    if (!currentSessionId.value) return
    sessionData.value.reviewRecords = records
    await saveReviewRecords(currentSessionId.value, records)
  }

  async function addImportLog(log: Omit<ImportLog, 'id'>): Promise<void> {
    const fullLog: ImportLog = {
      ...log,
      id: crypto.randomUUID(),
    }
    importLogs.value.push(fullLog)
    await saveImportLog(fullLog)
  }

  async function loadSettings(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      settings.value = await dbGetSettings()
    } catch (err) {
      error.value = (err as Error).message
    } finally {
      loading.value = false
    }
  }

  async function saveCurrentSettings(): Promise<void> {
    await dbSaveSettings(settings.value)
  }

  function clearCurrentSession(): void {
    currentSessionId.value = null
    currentSession.value = null
    resetSessionData()
  }

  return {
    sessions,
    currentSessionId,
    currentSession,
    sessionData,
    settings,
    importLogs,
    loading,
    error,
    hasCriticalUnresolved,
    risksByType,
    risksBySeverity,
    reviewStats,
    loadSessions,
    createNewSession,
    selectSession,
    loadCurrentSessionData,
    resetSessionData,
    updateCurrentSessionStatus,
    saveHorses,
    saveVetRecords,
    saveShoeingRecords,
    saveTackItems,
    saveRaceEntries,
    saveCurrentRisks,
    saveCurrentReviewRecords,
    addImportLog,
    loadSettings,
    saveCurrentSettings,
    clearCurrentSession,
  }
})
