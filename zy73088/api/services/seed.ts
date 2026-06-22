import {
  _now,
  _new_id,
  viewpointFingerprint,
  ConclusionEnum,
  RecordStatusEnum,
  defaultCameraUp,
  type ViewPoint,
  type CollisionPoint,
  type MaterialReviewItem,
  type SchemeComparisonRecord,
  type Remark,
  type HistoricalScreenshot,
} from '../shared/types.js';
import { recordRepository } from './repository.js';
import {
  SchemeComparisonFacade,
  UnifiedRenderSource,
  addRemarkToMaterial,
  createEmptyRecord,
} from './domain.js';

const DEMO_VP: ViewPoint = {
  camera_position: { x: 12.5, y: -8.3, z: 6.2 },
  camera_target: { x: 0, y: 0, z: 2.4 },
  camera_up: defaultCameraUp(),
  zoom: 1.15,
  fov: 50,
};

const ANOTHER_VP: ViewPoint = {
  camera_position: { x: -10, y: 10, z: 5 },
  camera_target: { x: 0, y: 0, z: 2.4 },
  camera_up: defaultCameraUp(),
  zoom: 1.0,
  fov: 50,
};

function buildDemoRecord(): SchemeComparisonRecord {
  const recordId = 'SCM-PRJDEMO000001';
  const renderSourceId = `RS-${recordId}`;
  const ts = _now();

  const historicalShot: HistoricalScreenshot = {
    path: 's3://demo-archive/2025-Q4/FZ-4/crack-before-repair.jpg',
    captured_at: '2025-11-03T09:12:40',
    viewpoint_fingerprint: viewpointFingerprint(DEMO_VP),
  };

  const col1: CollisionPoint = {
    collision_id: 'COL-000000000001',
    element_id: 'FZ-4',
    description: '柱脚北侧主受力钢筋保护层不足，存在锈蚀风险',
    screenshot_path: '/screenshots/FZ-4-N-base-20260115.png',
    viewpoint: { ...DEMO_VP },
    severity: 'high',
    detected_at: '2026-01-15T10:30:00',
    supplement_note: '现场回弹实测保护层厚度 12mm，设计要求 30mm',
    historical_screenshots: [historicalShot],
  };

  const col2dup: CollisionPoint = {
    collision_id: 'COL-000000000002',
    element_id: 'FZ-4',
    description: '柱脚北侧主受力钢筋保护层不足，存在锈蚀风险',
    screenshot_path: '/screenshots/FZ-4-N-base-duplicate.png',
    viewpoint: { ...DEMO_VP },
    severity: 'high',
    detected_at: '2026-01-15T10:45:00',
    supplement_note:
      '（重复条目，录入时未检索到已有记录，已自动进入待确认队列）',
    historical_screenshots: [],
  };

  const col3: CollisionPoint = {
    collision_id: 'COL-000000000003',
    element_id: 'FZ-4',
    description: '柱中截面环向箍筋间距偏大，抗剪承载力待校核',
    screenshot_path: '/screenshots/FZ-4-mid-stirrups.png',
    viewpoint: { ...ANOTHER_VP },
    severity: 'medium',
    detected_at: '2026-01-15T11:10:00',
    supplement_note: '箍筋间距 200mm，计算所需 150mm',
    historical_screenshots: [],
  };

  const remark1: Remark = {
    content: '本批碳纤维布已通过进场复检，强度指标满足 GB 50367-2013 要求',
    operator: '材料员小王',
    timestamp: '2026-01-15T09:00:00',
  };

  const matCarbon: MaterialReviewItem = {
    item_id: 'MAT-000000000001',
    material_name: '碳纤维布（一级 300g/㎡）',
    specification: '300g/㎡，幅宽 500mm，抗拉强度 ≥3400MPa',
    supplier: '上海固邦复合材料有限公司',
    batch_no: 'GB-CFRP-20260108-A2',
    quantity: 120,
    unit: '㎡',
    collision_points: [col1, col2dup],
    remarks: [remark1],
    created_at: '2026-01-15T08:30:00',
    created_by: '材料员小王',
  };

  const matGlue: MaterialReviewItem = {
    item_id: 'MAT-000000000002',
    material_name: '粘钢胶（A级结构胶）',
    specification: 'JGN-A 型，触变性好，25kg/桶',
    supplier: '北京冶建特种材料有限公司',
    batch_no: 'YJ-JGN-A-20260110',
    quantity: 50,
    unit: 'kg',
    collision_points: [col3],
    remarks: [],
    created_at: '2026-01-15T08:45:00',
    created_by: '材料员小王',
  };

  const record: SchemeComparisonRecord = createEmptyRecord({
    record_id: recordId,
    project_name: '某产业园标准厂房 3#楼结构加固项目',
    project_code: 'PRJ-DEMO',
    structural_element: '四层框架柱 FZ-4（轴网 C/3，截面 600×600）',
    status: RecordStatusEnum.PENDING_CONFIRM,
    conclusion: ConclusionEnum.SCHEME_B,
    confidence: 0.78,
    materials: [matCarbon, matGlue],
    render_source_id: renderSourceId,
    created_by: '结构工程师阿强',
    created_at: '2026-01-15T08:00:00',
    updated_at: ts,
    current_version: 1,
  });

  record.history_chain.push({
    version_id: 'HIS-000000000001',
    version_no: 1,
    parent_id: undefined,
    snapshot_material: {
      materials: JSON.parse(JSON.stringify(record.materials)),
      conclusion: null,
      confidence: 0,
      status: RecordStatusEnum.ACTIVE,
    },
    new_remarks: [],
    old_conclusion: undefined,
    new_conclusion: undefined,
    revise_reason: '初始创建',
    operator: '结构工程师阿强',
    operated_at: '2026-01-15T08:00:00',
    affected_conclusion_ids: [],
  });
  record.current_version = 2;

  record.history_chain.push({
    version_id: 'HIS-000000000002',
    version_no: 2,
    parent_id: 'HIS-000000000001',
    snapshot_material: {
      materials: JSON.parse(JSON.stringify(record.materials)),
      conclusion: ConclusionEnum.SCHEME_C,
      confidence: 0.62,
      status: RecordStatusEnum.ACTIVE,
    },
    new_remarks: [],
    old_conclusion: ConclusionEnum.SCHEME_C,
    new_conclusion: ConclusionEnum.SCHEME_B,
    revise_reason:
      '现场复核：增大截面方案影响建筑净高，改选碳纤维布加固；承载力富余系数从 1.02 下调至 0.95，需配合粘钢加强节点',
    operator: '施工经理阿乔',
    operated_at: '2026-01-15T14:20:00',
    affected_conclusion_ids: [],
  });
  record.current_version = 3;

  record.conclusion = ConclusionEnum.SCHEME_B;
  record.confidence = 0.78;

  record.audit_logs.push({
    log_id: 'LOG-000000000001',
    record_id: recordId,
    operator: '结构工程师阿强',
    operation_type: 'create',
    operation_detail: '创建方案比选记录',
    timestamp: '2026-01-15T08:00:00',
    field_changes: {},
  });

  record.audit_logs.push({
    log_id: 'LOG-000000000002',
    record_id: recordId,
    operator: '材料员小王',
    operation_type: 'update',
    operation_detail:
      '新增材料送审项 MAT-000000000001: 碳纤维布（一级 300g/㎡）',
    timestamp: '2026-01-15T08:30:00',
    field_changes: { materials: { added: 'MAT-000000000001' } },
  });

  record.audit_logs.push({
    log_id: 'LOG-000000000003',
    record_id: recordId,
    operator: '材料员小王',
    operation_type: 'update',
    operation_detail:
      '新增材料送审项 MAT-000000000002: 粘钢胶（A级结构胶）',
    timestamp: '2026-01-15T08:45:00',
    field_changes: { materials: { added: 'MAT-000000000002' } },
  });

  record.audit_logs.push({
    log_id: 'LOG-000000000004',
    record_id: recordId,
    operator: '施工经理阿乔',
    operation_type: 'revise_conclusion',
    operation_detail:
      '结论改判：方案C（增大截面） → 方案B（碳纤维布加固）；原因：现场复核：增大截面方案影响建筑净高，改选碳纤维布加固；承载力富余系数从 1.02 下调至 0.95，需配合粘钢加强节点',
    timestamp: '2026-01-15T14:20:00',
    field_changes: {
      conclusion: { old: ConclusionEnum.SCHEME_C, new: ConclusionEnum.SCHEME_B },
      confidence: { old: 0.62, new: 0.78 },
    },
  });

  const pending: (typeof record.pending_queue)[number] = {
    pending_id: 'PND-000000000001',
    record_id: recordId,
    material_item_id: 'MAT-000000000001',
    duplicate_collision_ids: ['COL-000000000001', 'COL-000000000002'],
    impact_analysis:
      '高危碰撞点 [柱脚北侧主受力钢筋保护层不足，存在锈蚀风险] 重复，直接影响材料用量核算；当前结论为「方案B（碳纤维布加固）」，待确认后可能发生改判',
    affected_conclusions: [
      'scheme_b',
      'needs_inspection',
      'scheme_a',
      'scheme_c',
    ],
    suspended_at: '2026-01-15T10:45:00',
    suspended_by: '系统（自动查重）',
  };
  record.pending_queue.push(pending);

  addRemarkToMaterial(
    matCarbon,
    '复检报告已上传至资料室共享盘 /PRJ-DEMO/Material/CFRP-20260108/',
    '质量工程师小李',
  );

  return record;
}

export function seedDemoIfEmpty(force = false): SchemeComparisonRecord | null {
  if (!recordRepository.initialized) {
    recordRepository.load();
  }
  if (!force && !recordRepository.isEmpty()) {
    // 兼容旧数据：若存在记录但没统一渲染源，刷新一次
    const all = recordRepository.list();
    for (const r of all) {
      if (!r.render_source_id || !r.scene_annotations) {
        UnifiedRenderSource.applyToRecord(r);
      }
    }
    if (all.length) recordRepository.flush();
    // 并把 PRJ-DEMO 代号记录的 id 固定成 PRJ-DEMO，便于前端定位
    const demo = all.find((x) => x.project_code === 'PRJ-DEMO');
    if (demo && demo.record_id !== 'PRJ-DEMO') {
      recordRepository.renameId(demo.record_id, 'PRJ-DEMO');
      demo.record_id = 'PRJ-DEMO';
      demo.render_source_id = `RS-${demo.record_id}`;
      UnifiedRenderSource.applyToRecord(demo);
      recordRepository.save(demo);
    }
    return null;
  }
  const demo = buildDemoRecord();
  demo.record_id = 'PRJ-DEMO';
  demo.render_source_id = `RS-${demo.record_id}`;
  UnifiedRenderSource.applyToRecord(demo);
  recordRepository.save(demo);
  return demo;
}

export function createRecord(params: {
  project_name: string;
  project_code: string;
  structural_element: string;
  operator: string;
}): SchemeComparisonRecord {
  const record = SchemeComparisonFacade.createRecord(params);
  recordRepository.save(record);
  return record;
}

export function ensureSeed(): { seeded: boolean; demoId: string | null } {
  if (!recordRepository.initialized) {
    recordRepository.load();
  }
  const existed = recordRepository.has('SCM-PRJDEMO000001');
  if (existed) {
    return { seeded: false, demoId: 'SCM-PRJDEMO000001' };
  }
  const demo = seedDemoIfEmpty(true);
  return { seeded: true, demoId: demo ? demo.record_id : null };
}
