import { getDb, generateId } from './init.js';
import type { Material, Track } from '../../shared/types.js';

export interface SeedData {
  batch1: { materials: Material[]; tracks: Track[] };
  batch2: { materials: Material[]; tracks: Track[] };
  batch3: { materials: Material[]; tracks: Track[] };
  messages: Array<{ material_id: string; content: string; message_date: string }>;
}

export function seedDatabase(): SeedData {
  const db = getDb();
  const now = new Date().toISOString();

  const batchId1 = generateId();
  db.prepare(`
    INSERT INTO import_batch (id, batch_id, file_name, total_count, new_count, reused_count, suspected_count, imported_by, imported_at, created_at)
    VALUES (?, ?, '授权期限页_第一批.xlsx', 3, 3, 0, 0, '版权运营', ?, ?)
  `).run(batchId1, batchId1, now, now);

  const materials1: Material[] = [];
  const tracks1: Track[] = [];

  const mat1Data: Omit<Material, 'id' | 'created_at' | 'updated_at'> = {
    material_name: '夜空最亮的星',
    isrc_code: 'CN-A12-24-00001',
    composer: '',
    project_name: '星空下的我们',
    license_start_date: '2024-01-01',
    license_end_date: '2026-12-31',
    episode_count: 36,
    license_fee: 50000,
    revenue_ratio: '0.15',
    error_tolerance: '',
    status: 'normal',
    batch_id: batchId1
  };
  const mat1 = insertMaterial(db, mat1Data, '版权运营');
  materials1.push(mat1);
  tracks1.push(insertTrack(db, mat1.id, '主题曲', 'V1', '主弦乐版，情绪饱满'));
  tracks1.push(insertTrack(db, mat1.id, '插曲', 'V1', '钢琴独奏版'));

  const mat2Data: Omit<Material, 'id' | 'created_at' | 'updated_at'> = {
    material_name: '城市的脚步',
    isrc_code: 'CN-A12-24-00002',
    composer: '',
    project_name: '都市追梦人',
    license_start_date: '2024-03-15',
    license_end_date: '2026-12-31',
    episode_count: 42,
    license_fee: 60000,
    revenue_ratio: '0.12',
    error_tolerance: '',
    status: 'normal',
    batch_id: batchId1
  };
  const mat2 = insertMaterial(db, mat2Data, '版权运营');
  materials1.push(mat2);
  tracks1.push(insertTrack(db, mat2.id, '片头曲', 'V1', '电子节奏型，适合片头'));

  const mat3Data: Omit<Material, 'id' | 'created_at' | 'updated_at'> = {
    material_name: '故乡的云',
    isrc_code: 'CN-A12-24-00003',
    composer: '',
    project_name: '山海情长',
    license_start_date: '2024-06-01',
    license_end_date: '2027-05-31',
    episode_count: 30,
    license_fee: 45000,
    revenue_ratio: '0.18',
    error_tolerance: '',
    status: 'normal',
    batch_id: batchId1
  };
  const mat3 = insertMaterial(db, mat3Data, '版权运营');
  materials1.push(mat3);
  tracks1.push(insertTrack(db, mat3.id, '片尾曲', 'V1', '民谣风格，吉他为主'));

  const batchId2 = generateId();
  db.prepare(`
    INSERT INTO import_batch (id, batch_id, file_name, total_count, new_count, reused_count, suspected_count, imported_by, imported_at, created_at)
    VALUES (?, ?, '授权期限页_第二批_错口径.xlsx', 2, 0, 1, 1, '版权运营', ?, ?)
  `).run(batchId2, batchId2, now, now);

  const materials2: Material[] = [];
  const tracks2: Track[] = [];

  const mat1DupData: Omit<Material, 'id' | 'created_at' | 'updated_at'> = {
    material_name: '夜空最亮的星',
    isrc_code: 'CN-A12-24-00001',
    composer: '',
    project_name: '星空下的我们',
    license_start_date: '2024-01-01',
    license_end_date: '2026-12-31',
    episode_count: 36,
    license_fee: 50000,
    revenue_ratio: '0.15',
    error_tolerance: '',
    status: 'normal',
    batch_id: batchId2
  };

  const mat4Data: Omit<Material, 'id' | 'created_at' | 'updated_at'> = {
    material_name: '城市的脚步',
    isrc_code: 'CN-A12-24-00002',
    composer: '',
    project_name: '都市追梦人',
    license_start_date: '2024-03-15',
    license_end_date: '2026-12-31',
    episode_count: 48,
    license_fee: 70000,
    revenue_ratio: '0.12',
    error_tolerance: '',
    status: 'conflict',
    batch_id: batchId2
  };
  const mat4 = insertMaterial(db, mat4Data, '版权运营');
  materials2.push(mat4);
  tracks2.push(insertTrack(db, mat4.id, '片头曲', 'V1', '导演要求调整节奏，加急返工'));

  const batchId3 = generateId();
  db.prepare(`
    INSERT INTO import_batch (id, batch_id, file_name, total_count, new_count, reused_count, suspected_count, imported_by, imported_at, created_at)
    VALUES (?, ?, '授权期限页_第三批_补录.xlsx', 2, 2, 0, 0, '版权运营', ?, ?)
  `).run(batchId3, batchId3, now, now);

  const materials3: Material[] = [];
  const tracks3: Track[] = [];

  const mat5Data: Omit<Material, 'id' | 'created_at' | 'updated_at'> = {
    material_name: '海上的月亮',
    isrc_code: 'CN-A12-24-00004',
    composer: '',
    project_name: '碧海蓝天',
    license_start_date: '2024-09-01',
    license_end_date: '2027-08-31',
    episode_count: 24,
    license_fee: 55000,
    revenue_ratio: '0.16',
    error_tolerance: '',
    status: 'rework_pending',
    batch_id: batchId3
  };
  const mat5 = insertMaterial(db, mat5Data, '版权运营');
  materials3.push(mat5);
  tracks3.push(insertTrack(db, mat5.id, '配乐主题', 'V2', '第一次返工，情绪不够饱满，重录调整配器', true));

  const mat6Data: Omit<Material, 'id' | 'created_at' | 'updated_at'> = {
    material_name: '山巅之风',
    isrc_code: 'CN-A12-24-00005',
    composer: '',
    project_name: '巅峰之路',
    license_start_date: '2024-11-01',
    license_end_date: '2027-10-31',
    episode_count: 40,
    license_fee: 80000,
    revenue_ratio: '0.20',
    error_tolerance: '',
    status: 'rework_pending',
    batch_id: batchId3
  };
  const mat6 = insertMaterial(db, mat6Data, '版权运营');
  materials3.push(mat6);
  tracks3.push(insertTrack(db, mat6.id, '主题音乐', 'V3', '第二次修改，导演说太柔了，要更有力量感。补录后重算', true));

  const messages: SeedData['messages'] = [
    {
      material_id: mat2.id,
      content: '许老师回看：调音师留言说《都市追梦人》实际是48集，保底费用应该是7万不是6万，授权开始时间是2024-03-20不是3月15日',
      message_date: '2024-04-10'
    },
    {
      material_id: mat5.id,
      content: '许老师补看：调音师群里留言说《海上的月亮》授权地域要加中国香港，分成比例要20%，上次的返工原因是配器不对，要加交响乐',
      message_date: '2024-10-15'
    }
  ];

  return {
    batch1: { materials: materials1, tracks: tracks1 },
    batch2: { materials: materials2, tracks: tracks2 },
    batch3: { materials: materials3, tracks: tracks3 },
    messages
  };
}

function insertMaterial(
  db: any,
  data: Omit<Material, 'id' | 'created_at' | 'updated_at'>,
  operator: string
): Material {
  const id = generateId();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO material (
      id, material_name, isrc_code, composer, project_name,
      license_start_date, license_end_date, episode_count,
      license_fee, revenue_ratio, error_tolerance,
      status, batch_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, data.material_name, data.isrc_code, data.composer, data.project_name,
    data.license_start_date, data.license_end_date, data.episode_count,
    data.license_fee, data.revenue_ratio, data.error_tolerance,
    data.status, data.batch_id, now, now
  );

  const changeId = generateId();
  db.prepare(`
    INSERT INTO rehearsal_change (
      id, material_id, track_id, field_name, old_value, new_value,
      operator, change_reason, affected_items, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    changeId, id, '', 'import', 'none', 'created',
    operator, '授权期限页第一次导入，创建素材记录',
    JSON.stringify([id]), now
  );

  db.prepare(`
    INSERT INTO history_record (
      id, material_id, track_id, record_snapshot, change_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    generateId(), id, '',
    JSON.stringify({ ...data, id, created_at: now, updated_at: now }),
    changeId, now
  );

  return { ...data, id, created_at: now, updated_at: now };
}

function insertTrack(
  db: any,
  material_id: string,
  track_name: string,
  track_version: string,
  remarks: string,
  hasRework: boolean = false
): Track {
  const id = generateId();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO track (
      id, material_id, track_name, track_number, track_type, isrc_code, remarks,
      need_recheck, rework_confirmed, rework_confirmed_by, rework_confirmed_at,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, material_id, track_name, 1, track_version, '', remarks,
    hasRework ? 1 : 0, 0, null, null, now, now
  );

  const changeId = generateId();
  db.prepare(`
    INSERT INTO rehearsal_change (
      id, material_id, track_id, field_name, old_value, new_value,
      operator, change_reason, affected_items, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    changeId, material_id, id, 'track_import', 'none', track_name,
    '版权运营', '导入时创建轨道记录',
    JSON.stringify([material_id, id]), now
  );

  db.prepare(`
    INSERT INTO history_record (
      id, material_id, track_id, record_snapshot, change_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    generateId(), material_id, id,
    JSON.stringify({
      id, material_id, track_name, track_number: 1, track_type: track_version, isrc_code: '', remarks,
      need_recheck: hasRework, rework_confirmed: false,
      created_at: now, updated_at: now
    }),
    changeId, now
  );

  return {
    id, material_id, track_name, track_number: 1, track_type: track_version, isrc_code: '', remarks,
    need_recheck: hasRework, rework_confirmed: false,
    rework_confirmed_by: '', rework_confirmed_at: '',
    created_at: now, updated_at: now
  };
}

export function getSeedMessages(): SeedData['messages'] {
  return seedDatabase().messages;
}

if (process.argv[1] && process.argv[1].includes('seed.ts')) {
  const result = seedDatabase();
  console.log('Database seeded successfully!');
  console.log(`  Batch 1: ${result.batch1.materials.length} materials, ${result.batch1.tracks.length} tracks`);
  console.log(`  Batch 2: ${result.batch2.materials.length} materials, ${result.batch2.tracks.length} tracks`);
  console.log(`  Batch 3: ${result.batch3.materials.length} materials, ${result.batch3.tracks.length} tracks`);
  console.log(`  Messages: ${result.messages.length} tuner messages`);
  console.log('  Total: 6 materials, 6 tracks, 2 messages');
}
