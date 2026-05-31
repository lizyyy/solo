import { openDB, type IDBPDatabase } from 'idb'
import type { FontRecord, ColorCard, OperationLog, ExportSnapshot, ImportSession } from '@/types'

const DB_NAME = 'FontLicenseTracker'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase> | null = null

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('records')) {
          const store = db.createObjectStore('records', { keyPath: 'id' })
          store.createIndex('fontName', 'fontName')
          store.createIndex('status', 'status')
          store.createIndex('expiryDate', 'expiryDate')
          store.createIndex('colorCardId', 'colorCardId')
        }
        if (!db.objectStoreNames.contains('colorCards')) {
          const store = db.createObjectStore('colorCards', { keyPath: 'id' })
          store.createIndex('name', 'name')
        }
        if (!db.objectStoreNames.contains('operationLogs')) {
          const store = db.createObjectStore('operationLogs', { keyPath: 'id' })
          store.createIndex('recordId', 'recordId')
          store.createIndex('timestamp', 'timestamp')
        }
        if (!db.objectStoreNames.contains('exportSnapshots')) {
          const store = db.createObjectStore('exportSnapshots', { keyPath: 'id' })
          store.createIndex('timestamp', 'timestamp')
        }
        if (!db.objectStoreNames.contains('importSessions')) {
          const store = db.createObjectStore('importSessions', { keyPath: 'id' })
          store.createIndex('timestamp', 'timestamp')
        }
      },
    })
  }
  return dbPromise
}

export async function dbGetAllRecords(): Promise<FontRecord[]> {
  const db = await getDB()
  return db.getAll('records')
}

export async function dbGetRecord(id: string): Promise<FontRecord | undefined> {
  const db = await getDB()
  return db.get('records', id)
}

export async function dbPutRecord(record: FontRecord): Promise<void> {
  const db = await getDB()
  await db.put('records', record)
}

export async function dbPutRecords(records: FontRecord[]): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('records', 'readwrite')
  for (const r of records) {
    await tx.store.put(r)
  }
  await tx.done
}

export async function dbDeleteRecord(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('records', id)
}

export async function dbGetAllColorCards(): Promise<ColorCard[]> {
  const db = await getDB()
  return db.getAll('colorCards')
}

export async function dbPutColorCard(card: ColorCard): Promise<void> {
  const db = await getDB()
  await db.put('colorCards', card)
}

export async function dbGetAllLogs(): Promise<OperationLog[]> {
  const db = await getDB()
  return db.getAll('operationLogs')
}

export async function dbPutLog(log: OperationLog): Promise<void> {
  const db = await getDB()
  await db.put('operationLogs', log)
}

export async function dbGetLogsByRecord(recordId: string): Promise<OperationLog[]> {
  const db = await getDB()
  return db.getAllFromIndex('operationLogs', 'recordId', recordId)
}

export async function dbGetAllSnapshots(): Promise<ExportSnapshot[]> {
  const db = await getDB()
  return db.getAll('exportSnapshots')
}

export async function dbPutSnapshot(snapshot: ExportSnapshot): Promise<void> {
  const db = await getDB()
  await db.put('exportSnapshots', snapshot)
}

export async function dbGetAllImportSessions(): Promise<ImportSession[]> {
  const db = await getDB()
  return db.getAll('importSessions')
}

export async function dbPutImportSession(session: ImportSession): Promise<void> {
  const db = await getDB()
  await db.put('importSessions', session)
}

export async function dbClearAll(): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(
    ['records', 'colorCards', 'operationLogs', 'exportSnapshots', 'importSessions'],
    'readwrite'
  )
  await tx.objectStore('records').clear()
  await tx.objectStore('colorCards').clear()
  await tx.objectStore('operationLogs').clear()
  await tx.objectStore('exportSnapshots').clear()
  await tx.objectStore('importSessions').clear()
  await tx.done
}
