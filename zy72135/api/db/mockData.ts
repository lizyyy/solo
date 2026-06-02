import db from './index';
import type { TrackCleanupRecord } from '../../shared/types';

function generateId(): string {
  return 'rec_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

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

export function initMockData() {
  const countStmt = db.prepare('SELECT COUNT(*) as count FROM track_cleanup_records');
  const result = countStmt.get() as { count: number };
  
  if (result.count > 0) {
    return;
  }

  const insertStmt = db.prepare(`
    INSERT INTO track_cleanup_records (
      id, track_name, artist_name, status, source, has_authorization,
      is_duplicate, is_old_master, is_renamed, original_track_name,
      current_note, latest_handler, latest_handle_time,
      original_source, original_handle_time, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();
  
  mockRecords.forEach((record) => {
    const id = generateId();
    insertStmt.run(
      id,
      record.trackName,
      record.artistName,
      record.status,
      record.source,
      record.hasAuthorization ? 1 : 0,
      record.isDuplicate ? 1 : 0,
      record.isOldMaster ? 1 : 0,
      record.isRenamed ? 1 : 0,
      record.originalTrackName || null,
      record.currentNote,
      record.latestHandler,
      record.latestHandleTime,
      record.originalSource,
      record.originalHandleTime,
      now,
      now
    );
  });
}
