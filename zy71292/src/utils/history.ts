import { openDB, type IDBPDatabase } from "idb"
import type { HistoryRecord } from "@/types"

const DB_NAME = "graph-community-splitter"
const DB_VERSION = 1
const STORE_NAME = "history"

async function getDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" })
      }
    },
  })
}

export async function saveHistory(record: HistoryRecord): Promise<void> {
  const db = await getDB()
  await db.put(STORE_NAME, record)
}

export async function loadHistory(): Promise<HistoryRecord[]> {
  const db = await getDB()
  const all = await db.getAll(STORE_NAME)
  return all.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )
}

export async function deleteHistory(id: string): Promise<void> {
  const db = await getDB()
  await db.delete(STORE_NAME, id)
}

export async function clearAllHistory(): Promise<void> {
  const db = await getDB()
  await db.clear(STORE_NAME)
}
