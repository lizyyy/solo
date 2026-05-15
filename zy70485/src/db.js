import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, '..', 'data')
const dbFile = path.join(dataDir, 'reconciliation.json')

const defaultData = {
  reconciliations: [],
  statusChanges: [],
  reminders: [],
  manualNotes: []
}

let db

export async function initDB() {
  const adapter = new JSONFile(dbFile)
  db = new Low(adapter, defaultData)
  await db.read()
  db.data ||= defaultData
  await db.write()
  return db
}

export async function getDB() {
  if (!db) {
    await initDB()
  }
  return db
}

export async function saveDB() {
  if (db) {
    await db.write()
  }
}
