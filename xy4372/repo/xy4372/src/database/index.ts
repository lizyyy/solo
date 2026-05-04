import { openDB, IDBPDatabase } from 'idb'
import type {
  Horse,
  VetRecord,
  ShoeingRecord,
  TackItem,
  RaceEntry,
  Risk,
  ReviewRecord,
  Session,
  ImportLog,
  AppSettings,
} from '@/types'

const DB_NAME = 'EquestrianPreCheckDB'
const DB_VERSION = 1

const STORES = {
  sessions: 'sessions',
  horses: 'horses',
  vetRecords: 'vetRecords',
  shoeingRecords: 'shoeingRecords',
  tackItems: 'tackItems',
  raceEntries: 'raceEntries',
  risks: 'risks',
  reviewRecords: 'reviewRecords',
  importLogs: 'importLogs',
  settings: 'settings',
} as const

export interface AppDB extends IDBPDatabase {
  getTransaction: (
    storeNames: typeof STORES[keyof typeof STORES][],
    mode?: 'readonly' | 'readwrite'
  ) => ReturnType<IDBPDatabase['transaction']>
}

export async function initDB(): Promise<AppDB> {
  const db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORES.sessions)) {
        const sessionsStore = db.createObjectStore(STORES.sessions, { keyPath: 'id' })
        sessionsStore.createIndex('date', 'date', { unique: false })
        sessionsStore.createIndex('createdAt', 'createdAt', { unique: false })
        sessionsStore.createIndex('status', 'status', { unique: false })
      }

      if (!db.objectStoreNames.contains(STORES.horses)) {
        const horsesStore = db.createObjectStore(STORES.horses, { keyPath: 'id' })
        horsesStore.createIndex('sessionId', 'sessionId', { unique: false })
        horsesStore.createIndex('horseNumber', 'horseNumber', { unique: false })
        horsesStore.createIndex('horseName', 'horseName', { unique: false })
      }

      if (!db.objectStoreNames.contains(STORES.vetRecords)) {
        const vetStore = db.createObjectStore(STORES.vetRecords, { keyPath: 'id' })
        vetStore.createIndex('sessionId', 'sessionId', { unique: false })
        vetStore.createIndex('horseNumber', 'horseNumber', { unique: false })
        vetStore.createIndex('treatmentDate', 'treatmentDate', { unique: false })
        vetStore.createIndex('recoveryDate', 'recoveryDate', { unique: false })
      }

      if (!db.objectStoreNames.contains(STORES.shoeingRecords)) {
        const shoeingStore = db.createObjectStore(STORES.shoeingRecords, { keyPath: 'id' })
        shoeingStore.createIndex('sessionId', 'sessionId', { unique: false })
        shoeingStore.createIndex('horseNumber', 'horseNumber', { unique: false })
        shoeingStore.createIndex('shoeingDate', 'shoeingDate', { unique: false })
        shoeingStore.createIndex('nextDueDate', 'nextDueDate', { unique: false })
      }

      if (!db.objectStoreNames.contains(STORES.tackItems)) {
        const tackStore = db.createObjectStore(STORES.tackItems, { keyPath: 'id' })
        tackStore.createIndex('sessionId', 'sessionId', { unique: false })
        tackStore.createIndex('tackNumber', 'tackNumber', { unique: false })
        tackStore.createIndex('tackType', 'tackType', { unique: false })
        tackStore.createIndex('assignedHorseNumber', 'assignedHorseNumber', { unique: false })
      }

      if (!db.objectStoreNames.contains(STORES.raceEntries)) {
        const raceStore = db.createObjectStore(STORES.raceEntries, { keyPath: 'id' })
        raceStore.createIndex('sessionId', 'sessionId', { unique: false })
        raceStore.createIndex('raceNumber', 'raceNumber', { unique: false })
        raceStore.createIndex('horseNumber', 'horseNumber', { unique: false })
        raceStore.createIndex('startTime', 'startTime', { unique: false })
      }

      if (!db.objectStoreNames.contains(STORES.risks)) {
        const risksStore = db.createObjectStore(STORES.risks, { keyPath: 'id' })
        risksStore.createIndex('sessionId', 'sessionId', { unique: false })
        risksStore.createIndex('horseNumber', 'horseNumber', { unique: false })
        risksStore.createIndex('type', 'type', { unique: false })
        risksStore.createIndex('severity', 'severity', { unique: false })
      }

      if (!db.objectStoreNames.contains(STORES.reviewRecords)) {
        const reviewStore = db.createObjectStore(STORES.reviewRecords, { keyPath: 'id' })
        reviewStore.createIndex('sessionId', 'sessionId', { unique: false })
        reviewStore.createIndex('riskId', 'riskId', { unique: false })
        reviewStore.createIndex('horseNumber', 'horseNumber', { unique: false })
        reviewStore.createIndex('coachJudgment', 'coachJudgment', { unique: false })
      }

      if (!db.objectStoreNames.contains(STORES.importLogs)) {
        const logsStore = db.createObjectStore(STORES.importLogs, { keyPath: 'id' })
        logsStore.createIndex('sessionId', 'sessionId', { unique: false })
        logsStore.createIndex('type', 'type', { unique: false })
        logsStore.createIndex('importedAt', 'importedAt', { unique: false })
      }

      if (!db.objectStoreNames.contains(STORES.settings)) {
        const settingsStore = db.createObjectStore(STORES.settings, { keyPath: 'id' })
      }
    },
  })

  return db as AppDB
}

let dbInstance: AppDB | null = null

export async function getDB(): Promise<AppDB> {
  if (!dbInstance) {
    dbInstance = await initDB()
  }
  return dbInstance
}

export async function closeDB(): Promise<void> {
  if (dbInstance) {
    dbInstance.close()
    dbInstance = null
  }
}

export async function saveSessionData(sessionId: string, data: {
  horses?: Horse[]
  vetRecords?: VetRecord[]
  shoeingRecords?: ShoeingRecord[]
  tackItems?: TackItem[]
  raceEntries?: RaceEntry[]
}): Promise<void> {
  const db = await getDB()
  const tx = db.transaction([
    STORES.horses,
    STORES.vetRecords,
    STORES.shoeingRecords,
    STORES.tackItems,
    STORES.raceEntries,
  ], 'readwrite')

  if (data.horses) {
    for (const horse of data.horses) {
      const horseWithSession = { ...horse, sessionId }
      await tx.objectStore(STORES.horses).put(horseWithSession)
    }
  }

  if (data.vetRecords) {
    for (const record of data.vetRecords) {
      const recordWithSession = { ...record, sessionId }
      await tx.objectStore(STORES.vetRecords).put(recordWithSession)
    }
  }

  if (data.shoeingRecords) {
    for (const record of data.shoeingRecords) {
      const recordWithSession = { ...record, sessionId }
      await tx.objectStore(STORES.shoeingRecords).put(recordWithSession)
    }
  }

  if (data.tackItems) {
    for (const item of data.tackItems) {
      const itemWithSession = { ...item, sessionId }
      await tx.objectStore(STORES.tackItems).put(itemWithSession)
    }
  }

  if (data.raceEntries) {
    for (const entry of data.raceEntries) {
      const entryWithSession = { ...entry, sessionId }
      await tx.objectStore(STORES.raceEntries).put(entryWithSession)
    }
  }

  await tx.done
}

export async function getSessionData(sessionId: string): Promise<{
  horses: Horse[]
  vetRecords: VetRecord[]
  shoeingRecords: ShoeingRecord[]
  tackItems: TackItem[]
  raceEntries: RaceEntry[]
  risks: Risk[]
  reviewRecords: ReviewRecord[]
}> {
  const db = await getDB()
  const tx = db.transaction([
    STORES.horses,
    STORES.vetRecords,
    STORES.shoeingRecords,
    STORES.tackItems,
    STORES.raceEntries,
    STORES.risks,
    STORES.reviewRecords,
  ], 'readonly')

  const [horses, vetRecords, shoeingRecords, tackItems, raceEntries, risks, reviewRecords] = await Promise.all([
    tx.objectStore(STORES.horses).index('sessionId').getAll(sessionId),
    tx.objectStore(STORES.vetRecords).index('sessionId').getAll(sessionId),
    tx.objectStore(STORES.shoeingRecords).index('sessionId').getAll(sessionId),
    tx.objectStore(STORES.tackItems).index('sessionId').getAll(sessionId),
    tx.objectStore(STORES.raceEntries).index('sessionId').getAll(sessionId),
    tx.objectStore(STORES.risks).index('sessionId').getAll(sessionId),
    tx.objectStore(STORES.reviewRecords).index('sessionId').getAll(sessionId),
  ])

  await tx.done

  return {
    horses: horses as Horse[],
    vetRecords: vetRecords as VetRecord[],
    shoeingRecords: shoeingRecords as ShoeingRecord[],
    tackItems: tackItems as TackItem[],
    raceEntries: raceEntries as RaceEntry[],
    risks: risks as Risk[],
    reviewRecords: reviewRecords as ReviewRecord[],
  }
}

export async function saveRisks(sessionId: string, risks: Risk[]): Promise<void> {
  const db = await getDB()
  const tx = db.transaction([STORES.risks], 'readwrite')
  
  const existingRisks = await tx.objectStore(STORES.risks).index('sessionId').getAllKeys(sessionId)
  for (const key of existingRisks) {
    await tx.objectStore(STORES.risks).delete(key)
  }

  for (const risk of risks) {
    await tx.objectStore(STORES.risks).put(risk)
  }

  await tx.done
}

export async function saveReviewRecords(sessionId: string, records: ReviewRecord[]): Promise<void> {
  const db = await getDB()
  const tx = db.transaction([STORES.reviewRecords], 'readwrite')

  for (const record of records) {
    await tx.objectStore(STORES.reviewRecords).put(record)
  }

  await tx.done
}

export async function saveImportLog(log: ImportLog): Promise<void> {
  const db = await getDB()
  await db.put(STORES.importLogs, log)
}

export async function getImportLogs(sessionId: string): Promise<ImportLog[]> {
  const db = await getDB()
  return db.getAllFromIndex(STORES.importLogs, 'sessionId', sessionId)
}

export async function createSession(session: Omit<Session, 'id' | 'createdAt' | 'updatedAt'>): Promise<Session> {
  const db = await getDB()
  const now = new Date().toISOString()
  const newSession: Session = {
    ...session,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  }
  await db.put(STORES.sessions, newSession)
  return newSession
}

export async function updateSession(sessionId: string, updates: Partial<Session>): Promise<void> {
  const db = await getDB()
  const session = await db.get(STORES.sessions, sessionId)
  if (session) {
    const updatedSession = {
      ...session,
      ...updates,
      updatedAt: new Date().toISOString(),
    }
    await db.put(STORES.sessions, updatedSession)
  }
}

export async function getSession(sessionId: string): Promise<Session | undefined> {
  const db = await getDB()
  return db.get(STORES.sessions, sessionId)
}

export async function getAllSessions(): Promise<Session[]> {
  const db = await getDB()
  const sessions = await db.getAll(STORES.sessions)
  return sessions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export async function getSettings(): Promise<AppSettings> {
  const db = await getDB()
  const settings = await db.get(STORES.settings, 'default')
  return settings || {
    defaultRestPeriodDays: 14,
    shoeingIntervalDays: 42,
    highTemperatureThreshold: 35,
    sizeTolerance: 2,
    reviewRequired: true,
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const db = await getDB()
  await db.put(STORES.settings, { ...settings, id: 'default' })
}

export { STORES }
