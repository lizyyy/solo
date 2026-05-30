import { openDB, type IDBPDatabase } from 'idb'
import type { LossCubeSnapshot, AnomalyRecord, DecisionLog } from '@/types'

const DB_NAME = 'insurance-loss-cube'
const DB_VERSION = 1

let dbInstance: IDBPDatabase | null = null

async function getDB(): Promise<IDBPDatabase> {
  if (dbInstance) return dbInstance

  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('snapshots')) {
        const snapshotStore = db.createObjectStore('snapshots', { keyPath: 'id' })
        snapshotStore.createIndex('typhoonId', 'typhoonId')
        snapshotStore.createIndex('createdAt', 'createdAt')
      }
      if (!db.objectStoreNames.contains('anomalies')) {
        const anomalyStore = db.createObjectStore('anomalies', { keyPath: 'id' })
        anomalyStore.createIndex('cubeSnapshotId', 'cubeSnapshotId')
        anomalyStore.createIndex('type', 'type')
        anomalyStore.createIndex('sourceType', 'sourceType')
      }
      if (!db.objectStoreNames.contains('decisions')) {
        const decisionStore = db.createObjectStore('decisions', { keyPath: 'id' })
        decisionStore.createIndex('cubeSnapshotId', 'cubeSnapshotId')
        decisionStore.createIndex('timestamp', 'timestamp')
      }
    },
  })

  return dbInstance
}

export async function saveSnapshot(snapshot: LossCubeSnapshot): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(['snapshots', 'anomalies', 'decisions'], 'readwrite')

  await tx.objectStore('snapshots').put(snapshot)

  for (const anomaly of snapshot.anomalies) {
    await tx.objectStore('anomalies').put(anomaly)
  }

  for (const decision of snapshot.decisions) {
    await tx.objectStore('decisions').put(decision)
  }

  await tx.done
}

export async function loadAllSnapshots(): Promise<LossCubeSnapshot[]> {
  const db = await getDB()
  return db.getAll('snapshots')
}

export async function loadSnapshotById(id: string): Promise<LossCubeSnapshot | undefined> {
  const db = await getDB()
  return db.get('snapshots', id)
}

export async function loadAnomaliesBySnapshot(snapshotId: string): Promise<AnomalyRecord[]> {
  const db = await getDB()
  const index = db.transaction('anomalies').store.index('cubeSnapshotId')
  return index.getAll(snapshotId)
}

export async function loadDecisionsBySnapshot(snapshotId: string): Promise<DecisionLog[]> {
  const db = await getDB()
  const index = db.transaction('decisions').store.index('cubeSnapshotId')
  return index.getAll(snapshotId)
}

export async function updateAnomaly(anomaly: AnomalyRecord): Promise<void> {
  const db = await getDB()
  await db.put('anomalies', anomaly)
}

export async function deleteSnapshot(id: string): Promise<void> {
  const db = await getDB()
  const anomalies = await loadAnomaliesBySnapshot(id)
  const decisions = await loadDecisionsBySnapshot(id)

  const tx = db.transaction(['snapshots', 'anomalies', 'decisions'], 'readwrite')
  await tx.objectStore('snapshots').delete(id)
  for (const a of anomalies) {
    await tx.objectStore('anomalies').delete(a.id)
  }
  for (const d of decisions) {
    await tx.objectStore('decisions').delete(d.id)
  }
  await tx.done
}
