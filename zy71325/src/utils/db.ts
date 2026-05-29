import { openDB, type IDBPDatabase } from "idb"
import type {
  RehearsalSession,
  TrackAudio,
  RehearsalMeta,
  AnomalyFragment,
  AlignmentVersion,
  ExportRecord,
  MaterialFile,
} from "@/types"

const DB_NAME = "rehearsal-track-organizer"
const DB_VERSION = 1

interface RehearsalDB {
  sessions: RehearsalSession
  tracks: TrackAudio
  meta: RehearsalMeta
  anomalies: AnomalyFragment
  versions: AlignmentVersion
  exports: ExportRecord
  materials: MaterialFile
}

let dbInstance: IDBPDatabase<RehearsalDB> | null = null

export async function getDB(): Promise<IDBPDatabase<RehearsalDB>> {
  if (dbInstance) return dbInstance

  dbInstance = await openDB<RehearsalDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("sessions")) {
        const store = db.createObjectStore("sessions", { keyPath: "id" })
        store.createIndex("createdAt", "createdAt")
      }
      if (!db.objectStoreNames.contains("tracks")) {
        const store = db.createObjectStore("tracks", { keyPath: "id" })
        store.createIndex("sessionId", "sessionId")
        store.createIndex("fileHash", "fileHash")
      }
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "sessionId" })
      }
      if (!db.objectStoreNames.contains("anomalies")) {
        const store = db.createObjectStore("anomalies", { keyPath: "id" })
        store.createIndex("trackId", "trackId")
        store.createIndex("type", "type")
        store.createIndex("resolved", "resolved")
        store.createIndex("sessionId", "sessionId")
      }
      if (!db.objectStoreNames.contains("versions")) {
        const store = db.createObjectStore("versions", { keyPath: "id" })
        store.createIndex("sessionId", "sessionId")
        store.createIndex("createdAt", "createdAt")
      }
      if (!db.objectStoreNames.contains("exports")) {
        const store = db.createObjectStore("exports", { keyPath: "id" })
        store.createIndex("versionId", "versionId")
        store.createIndex("exportedAt", "exportedAt")
      }
      if (!db.objectStoreNames.contains("materials")) {
        const store = db.createObjectStore("materials", { keyPath: "id" })
        store.createIndex("sessionId", "sessionId")
        store.createIndex("fileHash", "fileHash")
      }
    },
  })

  return dbInstance
}

export async function getAllSessions(): Promise<RehearsalSession[]> {
  const db = await getDB()
  return db.getAll("sessions")
}

export async function getSession(id: string): Promise<RehearsalSession | undefined> {
  const db = await getDB()
  return db.get("sessions", id)
}

export async function putSession(session: RehearsalSession): Promise<void> {
  const db = await getDB()
  await db.put("sessions", session)
}

export async function getTracksBySession(sessionId: string): Promise<TrackAudio[]> {
  const db = await getDB()
  const index = db.transaction("tracks").store.index("sessionId")
  return index.getAll(sessionId)
}

export async function getTrackByHash(fileHash: string): Promise<TrackAudio | undefined> {
  const db = await getDB()
  const index = db.transaction("tracks").store.index("fileHash")
  return index.get(fileHash)
}

export async function putTrack(track: TrackAudio): Promise<void> {
  const db = await getDB()
  await db.put("tracks", track)
}

export async function getMeta(sessionId: string): Promise<RehearsalMeta | undefined> {
  const db = await getDB()
  return db.get("meta", sessionId)
}

export async function putMeta(meta: RehearsalMeta): Promise<void> {
  const db = await getDB()
  await db.put("meta", meta)
}

export async function getAnomaliesBySession(sessionId: string): Promise<AnomalyFragment[]> {
  const db = await getDB()
  const all = await db.getAll("anomalies")
  return all.filter((a) => a.sessionId === sessionId)
}

export async function putAnomaly(anomaly: AnomalyFragment): Promise<void> {
  const db = await getDB()
  await db.put("anomalies", anomaly)
}

export async function putAnomalies(anomalies: AnomalyFragment[]): Promise<void> {
  const db = await getDB()
  const tx = db.transaction("anomalies", "readwrite")
  for (const a of anomalies) {
    await tx.store.put(a)
  }
  await tx.done
}

export async function getVersionsBySession(sessionId: string): Promise<AlignmentVersion[]> {
  const db = await getDB()
  const index = db.transaction("versions").store.index("sessionId")
  return index.getAll(sessionId)
}

export async function putVersion(version: AlignmentVersion): Promise<void> {
  const db = await getDB()
  await db.put("versions", version)
}

export async function getExportsByVersion(versionId: string): Promise<ExportRecord[]> {
  const db = await getDB()
  const index = db.transaction("exports").store.index("versionId")
  return index.getAll(versionId)
}

export async function putExport(record: ExportRecord): Promise<void> {
  const db = await getDB()
  await db.put("exports", record)
}

export async function getMaterialsBySession(sessionId: string): Promise<MaterialFile[]> {
  const db = await getDB()
  const index = db.transaction("materials").store.index("sessionId")
  return index.getAll(sessionId)
}

export async function getMaterialByHash(fileHash: string): Promise<MaterialFile | undefined> {
  const db = await getDB()
  const index = db.transaction("materials").store.index("fileHash")
  return index.get(fileHash)
}

export async function putMaterial(material: MaterialFile): Promise<void> {
  const db = await getDB()
  await db.put("materials", material)
}

export async function deleteMaterial(id: string): Promise<void> {
  const db = await getDB()
  await db.delete("materials", id)
}
