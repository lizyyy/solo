import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { 
  Session, 
  Sample, 
  GPSPoint, 
  TransferRecord, 
  LabRules, 
  Issue, 
  ReviewRecord,
  ImportLog
} from '@/types'
import { getDB, STORES } from '@/database'

export const useSessionStore = defineStore('session', () => {
  const currentSession = ref<Session | null>(null)
  const sessions = ref<Session[]>([])
  const samples = ref<Sample[]>([])
  const gpsPoints = ref<GPSPoint[]>([])
  const transferRecords = ref<TransferRecord[]>([])
  const labRules = ref<LabRules | null>(null)
  const issues = ref<Issue[]>([])
  const reviewRecords = ref<ReviewRecord[]>([])
  const importLogs = ref<ImportLog[]>([])
  const isLoaded = ref(false)

  const hasIssues = computed(() => issues.value.length > 0)
  
  const issuesBySample = computed(() => {
    const map = new Map<string, Issue[]>()
    for (const issue of issues.value) {
      const existing = map.get(issue.sampleNumber) || []
      existing.push(issue)
      map.set(issue.sampleNumber, existing)
    }
    return map
  })

  const reviewMap = computed(() => {
    return new Map(reviewRecords.value.map(r => [r.issueId, r]))
  })

  const issuesWithReviews = computed(() => {
    return issues.value.map(issue => ({
      issue,
      review: reviewMap.value.get(issue.id) || null,
    }))
  })

  const confirmedIssues = computed(() => 
    issuesWithReviews.value.filter(({ review }) => 
      !review || review.captainJudgment === 'confirmed'
    ).map(({ issue }) => issue)
  )

  const overruledIssues = computed(() => 
    issuesWithReviews.value.filter(({ review }) => 
      review?.captainJudgment === 'overruled'
    ).map(({ issue }) => issue)
  )

  const pendingIssues = computed(() => 
    issuesWithReviews.value.filter(({ review }) => 
      review?.captainJudgment === 'pending'
    ).map(({ issue }) => issue)
  )

  async function loadSessions(): Promise<void> {
    const db = await getDB()
    const all = await db.getAll(STORES.sessions)
    sessions.value = (all as Session[]).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }

  async function createSession(date: string, name?: string): Promise<Session> {
    const now = new Date().toISOString()
    const session: Session = {
      id: crypto.randomUUID(),
      date,
      createdAt: now,
      updatedAt: now,
      name: name || `${date} 收工检查`,
      status: 'importing',
    }

    const db = await getDB()
    await db.put(STORES.sessions, session)
    
    currentSession.value = session
    samples.value = []
    gpsPoints.value = []
    transferRecords.value = []
    issues.value = []
    reviewRecords.value = []
    importLogs.value = []
    isLoaded.value = true

    await loadSessions()
    return session
  }

  async function loadSession(sessionId: string): Promise<boolean> {
    const db = await getDB()
    
    const session = await db.get(STORES.sessions, sessionId) as Session | undefined
    if (!session) {
      return false
    }

    currentSession.value = session

    const transaction = db.transaction([
      STORES.samples,
      STORES.gpsPoints,
      STORES.transferRecords,
      STORES.labRules,
      STORES.issues,
      STORES.reviewRecords,
      STORES.importLogs,
    ], 'readonly')

    const [
      sessionSamples,
      sessionGpsPoints,
      sessionTransfers,
      allRules,
      sessionIssues,
      sessionReviews,
      sessionLogs,
    ] = await Promise.all([
      transaction.store.getAll(),
      transaction.objectStore(STORES.gpsPoints).getAll(),
      transaction.objectStore(STORES.transferRecords).getAll(),
      transaction.objectStore(STORES.labRules).getAll(),
      transaction.objectStore(STORES.issues).getAll(),
      transaction.objectStore(STORES.reviewRecords).getAll(),
      transaction.objectStore(STORES.importLogs).getAll(),
    ])

    samples.value = (sessionSamples as Sample[]).filter(s => true)
    gpsPoints.value = sessionGpsPoints as GPSPoint[]
    transferRecords.value = sessionTransfers as TransferRecord[]
    labRules.value = (allRules as LabRules[])[0] || null
    issues.value = sessionIssues as Issue[]
    reviewRecords.value = sessionReviews as ReviewRecord[]
    importLogs.value = sessionLogs as ImportLog[]
    isLoaded.value = true

    return true
  }

  async function saveSamples(newSamples: Sample[]): Promise<void> {
    if (!currentSession.value) return

    const db = await getDB()
    const transaction = db.transaction(STORES.samples, 'readwrite')
    
    for (const sample of newSamples) {
      await transaction.store.put({
        ...sample,
        sessionId: currentSession.value.id,
      })
    }

    await transaction.done
    
    samples.value = [...samples.value, ...newSamples]
    await updateSessionTimestamp()
  }

  async function saveGPSPoints(points: GPSPoint[]): Promise<void> {
    if (!currentSession.value) return

    const db = await getDB()
    const transaction = db.transaction(STORES.gpsPoints, 'readwrite')
    
    for (const point of points) {
      await transaction.store.put({
        ...point,
        sessionId: currentSession.value.id,
      })
    }

    await transaction.done
    
    gpsPoints.value = [...gpsPoints.value, ...points]
    await updateSessionTimestamp()
  }

  async function saveTransferRecords(records: TransferRecord[]): Promise<void> {
    if (!currentSession.value) return

    const db = await getDB()
    const transaction = db.transaction(STORES.transferRecords, 'readwrite')
    
    for (const record of records) {
      await transaction.store.put({
        ...record,
        sessionId: currentSession.value.id,
      })
    }

    await transaction.done
    
    transferRecords.value = [...transferRecords.value, ...records]
    await updateSessionTimestamp()
  }

  async function saveLabRules(rules: LabRules): Promise<void> {
    const db = await getDB()
    await db.put(STORES.labRules, rules)
    labRules.value = rules
  }

  async function saveIssues(newIssues: Issue[]): Promise<void> {
    if (!currentSession.value) return

    const db = await getDB()
    
    const existingKeys = issues.value.map(i => i.id)
    const transaction = db.transaction(STORES.issues, 'readwrite')
    for (const key of existingKeys) {
      await transaction.store.delete(key)
    }
    await transaction.done

    const insertTransaction = db.transaction(STORES.issues, 'readwrite')
    for (const issue of newIssues) {
      await insertTransaction.store.put({
        ...issue,
        sessionId: currentSession.value.id,
      })
    }
    await insertTransaction.done

    issues.value = newIssues
    await updateSessionTimestamp()
  }

  async function saveReviewRecord(review: ReviewRecord): Promise<void> {
    if (!currentSession.value) return

    const db = await getDB()
    const fullReview = {
      ...review,
      sessionId: currentSession.value.id,
    }
    await db.put(STORES.reviewRecords, fullReview)

    const existingIndex = reviewRecords.value.findIndex(r => r.id === review.id)
    if (existingIndex >= 0) {
      reviewRecords.value[existingIndex] = review
    } else {
      reviewRecords.value.push(review)
    }

    await updateSessionTimestamp()
  }

  async function saveImportLog(log: ImportLog): Promise<void> {
    if (!currentSession.value) return

    const db = await getDB()
    const fullLog = {
      ...log,
      sessionId: currentSession.value.id,
    }
    await db.put(STORES.importLogs, fullLog)
    importLogs.value.push(log)
  }

  async function updateSessionTimestamp(): Promise<void> {
    if (!currentSession.value) return

    currentSession.value.updatedAt = new Date().toISOString()
    const db = await getDB()
    await db.put(STORES.sessions, currentSession.value)
    
    const sessionIndex = sessions.value.findIndex(s => s.id === currentSession.value!.id)
    if (sessionIndex >= 0) {
      sessions.value[sessionIndex] = { ...currentSession.value }
    }
  }

  async function updateSessionStatus(status: Session['status']): Promise<void> {
    if (!currentSession.value) return

    currentSession.value.status = status
    await updateSessionTimestamp()
  }

  async function clearCurrentSessionData(): Promise<void> {
    if (!currentSession.value) return

    const db = await getDB()
    const transaction = db.transaction([
      STORES.samples,
      STORES.gpsPoints,
      STORES.transferRecords,
      STORES.issues,
      STORES.reviewRecords,
      STORES.importLogs,
    ], 'readwrite')

    await Promise.all([
      transaction.store.clear(),
      transaction.objectStore(STORES.gpsPoints).clear(),
      transaction.objectStore(STORES.transferRecords).clear(),
      transaction.objectStore(STORES.issues).clear(),
      transaction.objectStore(STORES.reviewRecords).clear(),
      transaction.objectStore(STORES.importLogs).clear(),
    ])

    await transaction.done

    samples.value = []
    gpsPoints.value = []
    transferRecords.value = []
    issues.value = []
    reviewRecords.value = []
    importLogs.value = []
  }

  async function deleteSession(sessionId: string): Promise<void> {
    const db = await getDB()
    
    await db.delete(STORES.sessions, sessionId)
    
    const stores = [
      STORES.samples,
      STORES.gpsPoints,
      STORES.transferRecords,
      STORES.issues,
      STORES.reviewRecords,
      STORES.importLogs,
    ]

    for (const storeName of stores) {
      const transaction = db.transaction(storeName, 'readwrite')
      const all = await transaction.store.getAll()
      for (const item of all) {
        if ((item as { sessionId?: string }).sessionId === sessionId) {
          await transaction.store.delete((item as { id: string }).id)
        }
      }
      await transaction.done
    }

    if (currentSession.value?.id === sessionId) {
      currentSession.value = null
      isLoaded.value = false
    }

    await loadSessions()
  }

  function clearCurrentSession(): void {
    currentSession.value = null
    samples.value = []
    gpsPoints.value = []
    transferRecords.value = []
    issues.value = []
    reviewRecords.value = []
    importLogs.value = []
    isLoaded.value = false
  }

  return {
    currentSession,
    sessions,
    samples,
    gpsPoints,
    transferRecords,
    labRules,
    issues,
    reviewRecords,
    importLogs,
    isLoaded,
    hasIssues,
    issuesBySample,
    reviewMap,
    issuesWithReviews,
    confirmedIssues,
    overruledIssues,
    pendingIssues,
    loadSessions,
    createSession,
    loadSession,
    saveSamples,
    saveGPSPoints,
    saveTransferRecords,
    saveLabRules,
    saveIssues,
    saveReviewRecord,
    saveImportLog,
    updateSessionStatus,
    clearCurrentSessionData,
    deleteSession,
    clearCurrentSession,
  }
})
