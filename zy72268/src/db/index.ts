import Dexie, { Table } from 'dexie';
import type {
  Obstacle,
  FloorSketch,
  PointCloudLog,
  Conflict,
  AuditLog,
  SelfCheckResult,
  NameHistory,
} from '../types';

export class AppDatabase extends Dexie {
  floorSketches!: Table<FloorSketch, string>;
  obstacles!: Table<Obstacle, string>;
  pointCloudLogs!: Table<PointCloudLog, string>;
  conflicts!: Table<Conflict, string>;
  auditLogs!: Table<AuditLog, string>;
  selfCheckResults!: Table<SelfCheckResult, string>;
  nameHistory!: Table<NameHistory & { obstacleId: string }, string>;

  constructor() {
    super('LogisticsSandboxDB');

    this.version(1).stores({
      floorSketches: 'id, name, floor, importedBy, importedAt, fileHash',
      obstacles: 'id, sketchId, currentName, source, status, isConflicted, position.x, position.y, position.z',
      pointCloudLogs: 'id, sketchId, name, processedBy, processedAt',
      conflicts: 'id, type, status, obstacleIds, requiresReview, createdAt, resolvedAt',
      auditLogs: 'id, userId, action, targetType, targetId, createdAt',
      selfCheckResults: 'id, type, status, checkedAt',
      nameHistory: 'id, obstacleId, changedBy, changedAt',
    });
  }
}

export const db = new AppDatabase();

export async function clearAllData(): Promise<void> {
  await Promise.all([
    db.floorSketches.clear(),
    db.obstacles.clear(),
    db.pointCloudLogs.clear(),
    db.conflicts.clear(),
    db.auditLogs.clear(),
    db.selfCheckResults.clear(),
    db.nameHistory.clear(),
  ]);
}
