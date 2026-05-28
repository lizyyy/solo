import { create } from 'zustand'
import type { Snapshot } from '@/types'
import { openDB } from 'idb'

const DB_NAME = 'fx-exposure-db'
const DB_VERSION = 1

async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('snapshots')) {
        db.createObjectStore('snapshots', { keyPath: 'id' })
      }
    },
  })
}

interface SnapshotState {
  snapshots: Snapshot[]
  loading: boolean
  loadSnapshots: () => Promise<void>
  saveSnapshot: (snapshot: Snapshot) => Promise<void>
  deleteSnapshot: (id: string) => Promise<void>
  getSnapshot: (id: string) => Promise<Snapshot | undefined>
}

export const useSnapshotStore = create<SnapshotState>((set) => ({
  snapshots: [],
  loading: false,

  loadSnapshots: async () => {
    set({ loading: true })
    const db = await getDB()
    const all = await db.getAll('snapshots')
    set({ snapshots: all.sort((a: Snapshot, b: Snapshot) => b.createdAt.localeCompare(a.createdAt)), loading: false })
  },

  saveSnapshot: async (snapshot) => {
    const db = await getDB()
    await db.put('snapshots', snapshot)
    set((s) => ({ snapshots: [snapshot, ...s.snapshots] }))
  },

  deleteSnapshot: async (id) => {
    const db = await getDB()
    await db.delete('snapshots', id)
    set((s) => ({ snapshots: s.snapshots.filter((sn) => sn.id !== id) }))
  },

  getSnapshot: async (id) => {
    const db = await getDB()
    return db.get('snapshots', id)
  },
}))
