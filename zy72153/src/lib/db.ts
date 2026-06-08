import Dexie, { type Table } from 'dexie'
import type { PointLocation, ApprovalRecord, MergeGroup, ConflictItem, PhotoAttachment } from '@/types'

class SpongeCityDB extends Dexie {
  points!: Table<PointLocation>
  approvals!: Table<ApprovalRecord>
  mergeGroups!: Table<MergeGroup>
  conflicts!: Table<ConflictItem>
  photos!: Table<PhotoAttachment>

  constructor() {
    super('SpongeCityDB_v5')
    this.version(1).stores({
      points: 'id, name, district, complaintId, status, approvalRef',
      approvals: 'id, approvalRef, locationName, district',
      mergeGroups: 'id, mergeType, status',
      conflicts: 'id, pointId, approvalId, conflictType, status',
      photos: 'id, pointId',
    })
  }
}

export const db = new SpongeCityDB()
