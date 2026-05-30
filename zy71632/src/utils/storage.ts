import { openDB, type IDBPDatabase } from 'idb'
import type { ProjectData } from '@/types'

const DB_NAME = 'vector-ski-classroom'
const DB_VERSION = 1
const STORE_NAME = 'projects'

let dbPromise: Promise<IDBPDatabase> | null = null

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
          store.createIndex('updatedAt', 'updatedAt')
        }
      },
    })
  }
  return dbPromise
}

export async function saveProject(project: ProjectData): Promise<void> {
  const db = await getDB()
  project.updatedAt = Date.now()
  await db.put(STORE_NAME, project)
}

export async function loadProject(id: string): Promise<ProjectData | undefined> {
  const db = await getDB()
  return db.get(STORE_NAME, id)
}

export async function loadLatestProject(): Promise<ProjectData | undefined> {
  const db = await getDB()
  const tx = db.transaction(STORE_NAME, 'readonly')
  const index = tx.store.index('updatedAt')
  let cursor = await index.openCursor(null, 'prev')
  if (cursor) {
    return cursor.value
  }
  return undefined
}

export async function listProjects(): Promise<ProjectData[]> {
  const db = await getDB()
  const all = await db.getAll(STORE_NAME)
  return all.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDB()
  await db.delete(STORE_NAME, id)
}
