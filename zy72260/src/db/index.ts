import Dexie, { Table } from 'dexie';
import {
  PointCloudLog,
  SafetyRadiusTable,
  Route,
  ConflictRecord,
  ExportRecord,
  DecisionLog,
  ImportHistoryItem,
  SelfCheckItem,
} from '@/types';

export class AppDatabase extends Dexie {
  pointCloudLogs!: Table<PointCloudLog>;
  safetyRadiusTables!: Table<SafetyRadiusTable>;
  routes!: Table<Route>;
  conflicts!: Table<ConflictRecord>;
  exports!: Table<ExportRecord>;
  decisionLogs!: Table<DecisionLog>;
  importHistory!: Table<ImportHistoryItem>;
  selfCheckLogs!: Table<SelfCheckItem>;

  constructor() {
    super('MuseumRouteSimulator');
    
    this.version(2).stores({
      pointCloudLogs: '&id, filename, importTime, fileHash',
      safetyRadiusTables: '&id, filename, importTime, version',
      routes: '&id, isSupplementary, reviewStatus',
      conflicts: '&id, exhibitId, status, severity',
      exports: '&id, version, exportTime, dataHash',
      decisionLogs: '&id, conflictId, operateTime',
      importHistory: '&id, type, fileHash, importTime, [type+fileHash]',
      selfCheckLogs: '&id, type, status, checkTime',
    });
  }
}

export const db = new AppDatabase();

export async function clearAllData() {
  await Promise.all([
    db.pointCloudLogs.clear(),
    db.safetyRadiusTables.clear(),
    db.routes.clear(),
    db.conflicts.clear(),
    db.exports.clear(),
    db.decisionLogs.clear(),
    db.importHistory.clear(),
    db.selfCheckLogs.clear(),
  ]);
}

export async function getFileHashHistory(fileHash: string, type: 'point_cloud' | 'safety_radius') {
  return await db.importHistory
    .where('[type+fileHash]')
    .equals([type, fileHash])
    .reverse()
    .sortBy('importTime');
}
