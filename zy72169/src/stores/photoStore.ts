import { create } from 'zustand'
import type { Photo } from '@/types'
import { getDB, generateId, nowISO } from '@/services/db'

interface PhotoState {
  photos: Photo[]
  loadAll: () => Promise<void>
  addPhoto: (photo: Omit<Photo, 'id' | 'uploadedAt'>) => Promise<void>
  getByLocationId: (locationId: string) => Photo[]
  deletePhoto: (id: string) => Promise<void>
}

export const usePhotoStore = create<PhotoState>((set, get) => ({
  photos: [],

  loadAll: async () => {
    const db = await getDB()
    const photos = await db.getAll('photos')
    set({ photos })
  },

  addPhoto: async (photo) => {
    const db = await getDB()
    const record: Photo = { ...photo, id: generateId(), uploadedAt: nowISO() }
    await db.put('photos', record)
    set((state) => ({ photos: [...state.photos, record] }))
  },

  getByLocationId: (locationId) => {
    return get().photos.filter((p) => p.locationId === locationId)
  },

  deletePhoto: async (id) => {
    const db = await getDB()
    await db.delete('photos', id)
    set((state) => ({
      photos: state.photos.filter((p) => p.id !== id),
    }))
  },
}))
