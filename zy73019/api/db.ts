process.removeAllListeners('warning');

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Track, Material, Revision, TrackStatus, LitterIssueType, MaterialType } from '../shared/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, '../tracks.db');
export const db = new DatabaseSync(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS tracks (
    id TEXT PRIMARY KEY,
    petName TEXT NOT NULL,
    aliases TEXT NOT NULL DEFAULT '[]',
    issueType TEXT NOT NULL,
    initialVisitDate TEXT NOT NULL,
    status TEXT NOT NULL,
    abnormalReason TEXT,
    currentNote TEXT NOT NULL DEFAULT '',
    revisionCount INTEGER NOT NULL DEFAULT 0,
    aliasWarning INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    lastOperator TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS materials (
    id TEXT PRIMARY KEY,
    trackId TEXT NOT NULL,
    type TEXT NOT NULL,
    fileName TEXT NOT NULL,
    filePath TEXT NOT NULL DEFAULT '',
    fileSize INTEGER NOT NULL DEFAULT 0,
    uploadedBy TEXT NOT NULL,
    uploadedAt TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    replacedMaterialId TEXT,
    summary TEXT NOT NULL DEFAULT '',
    hasConsistencyChange INTEGER NOT NULL DEFAULT 0,
    consistencyChangeNote TEXT,
    FOREIGN KEY (trackId) REFERENCES tracks(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS revisions (
    id TEXT PRIMARY KEY,
    trackId TEXT NOT NULL,
    version INTEGER NOT NULL,
    oldStatus TEXT,
    newStatus TEXT NOT NULL,
    reviseReason TEXT NOT NULL DEFAULT '',
    noteSnapshot TEXT NOT NULL DEFAULT '',
    operator TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    newMaterialIds TEXT NOT NULL DEFAULT '[]',
    FOREIGN KEY (trackId) REFERENCES tracks(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_materials_trackId ON materials(trackId);
  CREATE INDEX IF NOT EXISTS idx_revisions_trackId ON revisions(trackId);
`);

const trackCount = db.prepare('SELECT COUNT(*) as count FROM tracks').get() as { count: number };
if (trackCount.count === 0) {
  const now = new Date().toISOString();
  const earlier = new Date(Date.now() - 86400000 * 3).toISOString();
  const earlier2 = new Date(Date.now() - 86400000 * 7).toISOString();

  const insertTrack = db.prepare(`
    INSERT INTO tracks (id, petName, aliases, issueType, initialVisitDate, status, abnormalReason, currentNote, revisionCount, aliasWarning, createdAt, updatedAt, lastOperator)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMaterial = db.prepare(`
    INSERT INTO materials (id, trackId, type, fileName, filePath, fileSize, uploadedBy, uploadedAt, version, replacedMaterialId, summary, hasConsistencyChange, consistencyChangeNote)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertRevision = db.prepare(`
    INSERT INTO revisions (id, trackId, version, oldStatus, newStatus, reviseReason, noteSnapshot, operator, createdAt, newMaterialIds)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertTrack.run(
    'track-001',
    '小白',
    JSON.stringify(['白白', '雪球', '白团子']),
    'odor',
    earlier2,
    'observing',
    null,
    '首次回访异味问题仍存在，建议更换猫砂品牌继续观察',
    1,
    1,
    earlier2,
    earlier,
    '李医生'
  );
  insertMaterial.run(
    'mat-001',
    'track-001',
    'medical_record',
    '初诊病历-小白.pdf',
    '',
    204800,
    '王护士',
    earlier2,
    1,
    null,
    '初诊记录：猫砂盆使用正常，主人反映近一周异味明显加重，血常规正常',
    0,
    null
  );
  insertRevision.run(
    'rev-001',
    'track-001',
    1,
    'pending',
    'observing',
    '首次回访，症状未缓解，转入观察期',
    '首次回访异味问题仍存在，建议更换猫砂品牌继续观察',
    '李医生',
    earlier,
    JSON.stringify([])
  );

  insertTrack.run(
    'track-002',
    '雪球',
    JSON.stringify(['白胖子', '团子']),
    'usage',
    earlier,
    'pending',
    '宠物名"雪球"与track-001别名"雪球"冲突',
    '新建立案，待首次回访确认使用异常情况',
    0,
    1,
    earlier,
    earlier,
    '张医生'
  );
  insertMaterial.run(
    'mat-002',
    'track-002',
    'oral_note',
    '口头登记.txt',
    '',
    1024,
    '前台小陈',
    earlier,
    1,
    null,
    '主人电话反映猫最近不太使用猫砂盆，常在角落排泄',
    0,
    null
  );

  insertTrack.run(
    'track-003',
    '橘座',
    JSON.stringify(['大橘', '橘子']),
    'appearance',
    now,
    'transferred',
    null,
    '外观异常情况复杂，已转专科医生进一步检查',
    2,
    0,
    earlier2,
    now,
    '王医生'
  );
  insertMaterial.run(
    'mat-003',
    'track-003',
    'medical_record',
    '外观检查初诊.pdf',
    '',
    307200,
    '王护士',
    earlier2,
    1,
    null,
    '初诊：猫砂盆边缘有异常划痕，猫爪垫有轻微红肿',
    0,
    null
  );
  insertMaterial.run(
    'mat-004',
    'track-003',
    'attachment',
    '爪部特写照片.jpg',
    '',
    1048576,
    '李医生',
    earlier,
    1,
    null,
    '补充爪部照片，可见红肿范围扩大，建议皮肤科会诊',
    1,
    '与初诊记录中"轻微红肿"描述不一致，红肿范围明显扩大'
  );
  insertRevision.run(
    'rev-002',
    'track-003',
    1,
    'pending',
    'observing',
    '外观异常需要持续观察变化情况',
    '外观有异常划痕和轻微红肿，已建议主人观察变化',
    '王医生',
    earlier2,
    JSON.stringify([])
  );
  insertRevision.run(
    'rev-003',
    'track-003',
    2,
    'observing',
    'transferred',
    '症状加重，转皮肤科专科处理',
    '外观异常情况复杂，已转专科医生进一步检查',
    '王医生',
    now,
    JSON.stringify(['mat-004'])
  );
}

export type TrackRow = Omit<Track, 'aliases' | 'aliasWarning' | 'materials'> & {
  aliases: string;
  aliasWarning: number;
};

export type MaterialRow = Omit<Material, 'hasConsistencyChange'> & {
  hasConsistencyChange: number;
};

export type RevisionRow = Omit<Revision, 'newMaterialIds' | 'oldStatus'> & {
  newMaterialIds: string;
  oldStatus: string | null;
};

export function rowToTrack(row: TrackRow, materials: Material[] = []): Track {
  return {
    ...row,
    aliases: JSON.parse(row.aliases),
    aliasWarning: row.aliasWarning === 1,
    materials,
  };
}

export function rowToMaterial(row: MaterialRow): Material {
  return {
    ...row,
    hasConsistencyChange: row.hasConsistencyChange === 1,
  };
}

export function rowToRevision(row: RevisionRow): Revision {
  return {
    ...row,
    oldStatus: row.oldStatus as TrackStatus | null,
    newMaterialIds: JSON.parse(row.newMaterialIds),
  };
}
