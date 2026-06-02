import { create } from 'zustand'
import { db } from '@/lib/db'
import type { PointLocation, ApprovalRecord, MergeGroup, ConflictItem, PhotoAttachment } from '@/types'
import { detectSameNameGroups, detectDuplicateComplaints, detectCoordinateDrift, detectConflicts } from '@/lib/merge-detect'

interface AppState {
  points: PointLocation[]
  approvals: ApprovalRecord[]
  mergeGroups: MergeGroup[]
  conflicts: ConflictItem[]
  photos: PhotoAttachment[]
  loading: boolean
  loadData: () => Promise<void>
  addPoints: (points: PointLocation[]) => Promise<void>
  addApprovals: (approvals: ApprovalRecord[]) => Promise<void>
  addPhotos: (pointId: string, files: File[]) => Promise<void>
  deletePhoto: (photoId: string) => Promise<void>
  confirmMergeGroup: (groupId: string) => Promise<void>
  cancelMergeGroup: (groupId: string) => Promise<void>
  resolveConflict: (conflictId: string, resolution: string, status: ConflictItem['status']) => Promise<void>
  updatePoint: (id: string, data: Partial<PointLocation>) => Promise<void>
  deletePoint: (id: string) => Promise<void>
  runMergeDetection: () => Promise<void>
  runConflictDetection: () => Promise<void>
  getPointById: (id: string) => PointLocation | undefined
  getPhotosForPoint: (pointId: string) => PhotoAttachment[]
  getConflictsForPoint: (pointId: string) => ConflictItem[]
}

export const useStore = create<AppState>((set, get) => ({
  points: [],
  approvals: [],
  mergeGroups: [],
  conflicts: [],
  photos: [],
  loading: false,

  loadData: async () => {
    set({ loading: true })
    const [points, approvals, mergeGroups, conflicts, photos] = await Promise.all([
      db.points.toArray(),
      db.approvals.toArray(),
      db.mergeGroups.toArray(),
      db.conflicts.toArray(),
      db.photos.toArray(),
    ])
    set({ points, approvals, mergeGroups, conflicts, photos, loading: false })
  },

  addPoints: async (points: PointLocation[]) => {
    await db.points.bulkPut(points)
    set({ points: await db.points.toArray() })
  },

  addApprovals: async (approvals: ApprovalRecord[]) => {
    await db.approvals.bulkPut(approvals)
    set({ approvals: await db.approvals.toArray() })
  },

  addPhotos: async (pointId: string, files: File[]) => {
    const newPhotos: PhotoAttachment[] = files.map(f => ({
      id: Date.now().toString(36) + Math.random().toString(36).substring(2, 8),
      pointId,
      fileName: f.name,
      fileType: f.type,
      fileData: f,
      uploadedAt: new Date().toISOString(),
    }))
    await db.photos.bulkAdd(newPhotos)
    set({ photos: await db.photos.toArray() })
  },

  deletePhoto: async (photoId: string) => {
    await db.photos.delete(photoId)
    set({ photos: await db.photos.toArray() })
  },

  confirmMergeGroup: async (groupId: string) => {
    const group = await db.mergeGroups.get(groupId)
    if (!group) return
    await db.mergeGroups.update(groupId, { status: 'confirmed' })
    const primaryId = group.mergedIds[0]
    const secondaryIds = group.mergedIds.slice(1)
    const primary = await db.points.get(primaryId)
    if (primary) {
      await db.points.update(primaryId, {
        status: 'merged',
        mergeReason: group.reason,
        mergedFrom: [...(primary.mergedFrom || []), ...secondaryIds],
        updatedAt: new Date().toISOString(),
      })
    }
    for (const sid of secondaryIds) {
      await db.points.update(sid, {
        status: 'merged',
        mergeReason: group.reason,
        updatedAt: new Date().toISOString(),
      })
    }
    set({
      mergeGroups: await db.mergeGroups.toArray(),
      points: await db.points.toArray(),
    })
  },

  cancelMergeGroup: async (groupId: string) => {
    await db.mergeGroups.update(groupId, { status: 'cancelled' })
    set({ mergeGroups: await db.mergeGroups.toArray() })
  },

  resolveConflict: async (conflictId: string, resolution: string, status: ConflictItem['status']) => {
    await db.conflicts.update(conflictId, { resolution, status })
    set({ conflicts: await db.conflicts.toArray() })
  },

  updatePoint: async (id: string, data: Partial<PointLocation>) => {
    await db.points.update(id, { ...data, updatedAt: new Date().toISOString() })
    set({ points: await db.points.toArray() })
  },

  deletePoint: async (id: string) => {
    await db.points.delete(id)
    await db.photos.where('pointId').equals(id).delete()
    await db.conflicts.where('pointId').equals(id).delete()
    set({
      points: await db.points.toArray(),
      photos: await db.photos.toArray(),
      conflicts: await db.conflicts.toArray(),
    })
  },

  runMergeDetection: async () => {
    const points = get().points.filter(p => p.status !== 'merged')
    const sameNameGroups = detectSameNameGroups(points)
    const duplicateGroups = detectDuplicateComplaints(points)
    const driftGroups = detectCoordinateDrift(points)
    const allGroups = [...sameNameGroups, ...duplicateGroups, ...driftGroups]
    if (allGroups.length > 0) {
      await db.mergeGroups.bulkAdd(allGroups)
    }
    set({ mergeGroups: await db.mergeGroups.toArray() })
  },

  runConflictDetection: async () => {
    const { points, approvals } = get()
    const newConflicts = detectConflicts(points, approvals)
    if (newConflicts.length > 0) {
      await db.conflicts.bulkAdd(newConflicts)
    }
    set({ conflicts: await db.conflicts.toArray() })
  },

  getPointById: (id: string) => {
    return get().points.find(p => p.id === id)
  },

  getPhotosForPoint: (pointId: string) => {
    return get().photos.filter(p => p.pointId === pointId)
  },

  getConflictsForPoint: (pointId: string) => {
    return get().conflicts.filter(c => c.pointId === pointId)
  },
}))
