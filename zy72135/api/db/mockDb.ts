import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { TrackCleanupRecord, VersionHistory, FilterState } from '../../shared/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../../data');
const RECORDS_FILE = path.join(DATA_DIR, 'records.json');
const VERSIONS_FILE = path.join(DATA_DIR, 'version_history.json');

let records: TrackCleanupRecord[] = [];
let versionHistory: VersionHistory[] = [];

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadFromDisk() {
  try {
    if (fs.existsSync(RECORDS_FILE)) {
      const raw = fs.readFileSync(RECORDS_FILE, 'utf-8');
      records = JSON.parse(raw);
    }
    if (fs.existsSync(VERSIONS_FILE)) {
      const raw = fs.readFileSync(VERSIONS_FILE, 'utf-8');
      versionHistory = JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to load data from disk, starting fresh:', e);
    records = [];
    versionHistory = [];
  }
}

function saveToDisk() {
  ensureDataDir();
  try {
    fs.writeFileSync(RECORDS_FILE, JSON.stringify(records, null, 2), 'utf-8');
    fs.writeFileSync(VERSIONS_FILE, JSON.stringify(versionHistory, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save data to disk:', e);
  }
}

function generateId(prefix: string): string {
  return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

export function initMockDatabase() {
  ensureDataDir();
  loadFromDisk();

  if (records.length > 0) return;

  const now = new Date().toISOString();

  const mockRecords: Omit<TrackCleanupRecord, 'id' | 'createdAt' | 'updatedAt'>[] = [
    {
      trackName: '星空叙事曲',
      artistName: '李同学',
      status: 'approved',
      source: 'stage_channel',
      hasAuthorization: true,
      isDuplicate: false,
      isOldMaster: false,
      isRenamed: false,
      currentNote: '编曲工程轨道完整，分轨清晰，可直接用于演出。对比去年版本，配器层次感明显提升，老师表示满意。',
      latestHandler: '小孟',
      latestHandleTime: '2026-05-28 14:30:00',
      originalSource: '舞台通道表 #2026-05-A12',
      originalHandleTime: '2026-05-20 09:15:00',
    },
    {
      trackName: '城市边缘',
      artistName: '王同学',
      status: 'pending',
      source: 'manual',
      hasAuthorization: true,
      isDuplicate: true,
      isOldMaster: false,
      isRenamed: false,
      currentNote: '疑似与存档中《城市边界》为同一作品，请王同学确认是否为同曲异名或重新编曲版本。',
      latestHandler: '小孟',
      latestHandleTime: '2026-05-30 16:45:00',
      originalSource: '人工补录 - 邮件提交',
      originalHandleTime: '2026-05-25 11:20:00',
    },
    {
      trackName: '月光奏鸣曲(旧版)',
      artistName: '张同学',
      status: 'needs_supplement',
      source: 'imported_old',
      hasAuthorization: true,
      isDuplicate: false,
      isOldMaster: true,
      isRenamed: false,
      currentNote: '2023年旧口径录入版本，当前已有2025重制版，需确认是否保留旧版母带作为资料归档。',
      latestHandler: '小孟',
      latestHandleTime: '2026-05-29 10:00:00',
      originalSource: '舞台通道表 #2023-Q3-047',
      originalHandleTime: '2023-09-15 16:30:00',
    },
    {
      trackName: '夏日回忆',
      artistName: '赵同学',
      status: 'obsolete',
      source: 'stage_channel',
      hasAuthorization: true,
      isDuplicate: false,
      isOldMaster: true,
      isRenamed: false,
      currentNote: '标记为旧版母带，已由《夏日回忆录》2025重制版替代。',
      latestHandler: '小孟',
      latestHandleTime: '2026-05-27 09:30:00',
      originalSource: '舞台通道表 #2024-08-B21',
      originalHandleTime: '2024-08-10 14:00:00',
    },
    {
      trackName: '时间缝隙',
      artistName: '刘同学',
      status: 'pending',
      source: 'stage_channel',
      hasAuthorization: true,
      isDuplicate: true,
      isOldMaster: false,
      isRenamed: false,
      currentNote: '与现有曲目《时间裂痕》BPM、和弦走向高度相似，需刘同学说明两首作品的关系。',
      latestHandler: '小孟',
      latestHandleTime: '2026-06-01 11:15:00',
      originalSource: '舞台通道表 #2026-06-C03',
      originalHandleTime: '2026-05-28 15:45:00',
    },
    {
      trackName: '未知海域',
      artistName: '陈同学',
      status: 'needs_supplement',
      source: 'manual',
      hasAuthorization: false,
      isDuplicate: false,
      isOldMaster: false,
      isRenamed: false,
      currentNote: '缺少采样素材授权文件，特别是01:23处的海洋环境音，请补充提供授权证明。',
      latestHandler: '小孟',
      latestHandleTime: '2026-06-01 15:30:00',
      originalSource: '人工补录 - 网盘提交',
      originalHandleTime: '2026-05-30 10:00:00',
    },
    {
      trackName: '初雪(原:冬之恋)',
      artistName: '孙同学',
      status: 'approved',
      source: 'stage_channel',
      hasAuthorization: true,
      isDuplicate: false,
      isOldMaster: false,
      isRenamed: true,
      originalTrackName: '冬之恋',
      currentNote: '作品人工改名，原名为《冬之恋》，已由孙同学确认更名原因：作品情感基调更贴近初雪的宁静感。',
      latestHandler: '小孟',
      latestHandleTime: '2026-05-26 13:45:00',
      originalSource: '舞台通道表 #2026-05-A08',
      originalHandleTime: '2026-05-18 11:30:00',
    },
    {
      trackName: '风之诗',
      artistName: '周同学',
      status: 'approved',
      source: 'stage_channel',
      hasAuthorization: true,
      isDuplicate: false,
      isOldMaster: false,
      isRenamed: false,
      currentNote: '对比去年版本进步显著：旋律线条更流畅，和声运用更成熟，编曲动态范围控制得当。老师评语："堪称年度最佳进步作品"。',
      latestHandler: '小孟',
      latestHandleTime: '2026-05-25 16:00:00',
      originalSource: '舞台通道表 #2026-05-A03',
      originalHandleTime: '2026-05-15 09:00:00',
    },
  ];

  records = mockRecords.map((r) => ({
    ...r,
    id: generateId('rec'),
    createdAt: now,
    updatedAt: now,
  }));

  versionHistory = [
    {
      id: generateId('ver'),
      recordId: records[0].id,
      fieldName: '备注',
      oldValue: '初始提交',
      newValue: records[0].currentNote,
      modifiedBy: '小孟',
      modifiedAt: '2026-05-28T14:30:00.000Z',
    },
  ];

  saveToDisk();
}

export function findAllRecords(filters?: FilterState): TrackCleanupRecord[] {
  let result = [...records];

  if (filters?.status) {
    result = result.filter((r) => r.status === filters.status);
  }
  if (filters?.source) {
    result = result.filter((r) => r.source === filters.source);
  }
  if (filters?.searchKeyword) {
    const keyword = filters.searchKeyword.toLowerCase();
    result = result.filter(
      (r) =>
        r.trackName.toLowerCase().includes(keyword) ||
        r.artistName.toLowerCase().includes(keyword) ||
        r.currentNote.toLowerCase().includes(keyword)
    );
  }
  if (filters?.dateFrom) {
    result = result.filter((r) => r.latestHandleTime >= filters.dateFrom!);
  }
  if (filters?.dateTo) {
    result = result.filter((r) => r.latestHandleTime <= filters.dateTo!);
  }

  return result.sort((a, b) => b.latestHandleTime.localeCompare(a.latestHandleTime));
}

export function findRecordById(id: string): TrackCleanupRecord | undefined {
  return records.find((r) => r.id === id);
}

export function updateRecord(
  id: string,
  updates: Partial<TrackCleanupRecord>
): TrackCleanupRecord | undefined {
  const index = records.findIndex((r) => r.id === id);
  if (index === -1) return undefined;

  records[index] = {
    ...records[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  saveToDisk();
  return records[index];
}

export function findVersionHistory(recordId: string): VersionHistory[] {
  return versionHistory
    .filter((v) => v.recordId === recordId)
    .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
}

export function createVersionHistory(
  recordId: string,
  fieldName: string,
  oldValue: string,
  newValue: string,
  modifiedBy: string
): VersionHistory {
  const version: VersionHistory = {
    id: generateId('ver'),
    recordId,
    fieldName,
    oldValue,
    newValue,
    modifiedBy,
    modifiedAt: new Date().toISOString(),
  };
  versionHistory.push(version);
  saveToDisk();
  return version;
}
