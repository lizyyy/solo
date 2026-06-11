import { db } from './index.js';
import { CollisionRepo } from '../repositories/CollisionRepo.js';
import { MaterialRepo } from '../repositories/MaterialRepo.js';
import { VersionRepo } from '../repositories/VersionRepo.js';
import { AuditRepo } from '../repositories/AuditRepo.js';
import type { Collision, Material, VersionSnapshot, AuditLog } from '../../shared/types.js';
import {
  uid,
  md5,
  nowISO,
  pad,
  formatCollisionSeq,
  diffFields,
  changeTypeLabel,
  materialTypeLabel,
} from '../utils.js';

const DESIGNER = { id: 'DS001', name: '阿宁', role: 'designer' };
const ENGINEER_A = { id: 'EN002', name: '张工', role: 'engineer' };
const ENGINEER_B = { id: 'EN003', name: '李工', role: 'engineer' };

const FLOORS = ['B2', 'B1', 'F1', 'F2', 'F3', 'RF'];
const DISCIPLINES = ['机电', '结构', '建筑'];
const STATUSES: Array<Collision['status']> = ['pending', 'processing', 'resolved', 'waived'];

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function shiftTime(base: string, hours: number): string {
  const d = new Date(base);
  d.setHours(d.getHours() + hours);
  return d.toISOString();
}

const collisionRepo = new CollisionRepo();
const materialRepo = new MaterialRepo();
const versionRepo = new VersionRepo();
const auditRepo = new AuditRepo();

// 若已有数据则跳过
if (collisionRepo.list().length > 0) {
  console.log('[seed] 已有数据，跳过。如需重新初始化请删除 data/db.json');
  process.exit(0);
}

const baseTime = new Date();
baseTime.setDate(baseTime.getDate() - 3);

// 4 条核心场景数据
const scenarios = [
  {
    id: formatCollisionSeq(1),
    floor: 'F2',
    discipline: '机电',
    status: 'resolved' as const,
    isAbnormal: false,
    remark: '水管与消防主管间距不足50mm，已改位。',
    conclusion: '设计调整：将DN80冷水管向南平移200mm。',
    bimNote: 'F2-07轴/C轴 机电水管 BIM备注：冷水管DN80穿梁预留洞已按图施工，与消防主管净距不满足规范要求，提请设计院确认。',
    bimNoteV2: null as string | null,
    boundary: '边界样本：轴线坐标X=12450,Y=8760；预留洞中心标高+4.250；梁宽300x600。',
    verbal: '阿宁口头说明：现场监理催单，请3日内回复处理意见。',
    engineerOps: [
      { who: ENGINEER_A, type: 'remark', detail: '张工补充备注：复核图纸后确认按原碰撞结论处理。' },
    ],
  },
  {
    id: formatCollisionSeq(2),
    floor: 'B1',
    discipline: '结构',
    status: 'processing' as const,
    isAbnormal: false,
    remark: '结构柱偏移与机电桥架冲突，复核中。',
    conclusion: '',
    bimNote: 'B1-12轴/E轴 结构柱 BIM备注：KZ-5原定位X=16200,Y=9400，现场定位偏移约150mm。',
    bimNoteV2: '【修改版】B1-12轴/E轴 结构柱 BIM备注：KZ-5原定位X=16200,Y=9400，现场定位偏移约250mm（施工队复核后确认是250mm，前版150mm有误），请按250mm处理。',
    boundary: '边界样本：柱截面600x600；相关构件：桥架CT-400x200标高-2.800；相邻风管1250x500。',
    verbal: '口头说明：阿宁11:30来电说现场重新测了，改250mm。',
    engineerOps: [
      { who: ENGINEER_A, type: 'remark', detail: '张工备注：发现阿宁改了BIM备注，需以最新版为准。' },
    ],
  },
  {
    id: formatCollisionSeq(3),
    floor: 'F1',
    discipline: '机电',
    status: 'waived' as const,
    isAbnormal: true,
    abnormalReason: '该碰撞点与CP-2026-06-00001为同一构件同一问题，按重复记录豁免，不重复签发变更单。',
    remark: '已与CP-2026-06-00001核对，属重复记录，合并处理。',
    conclusion: '重复碰撞点，合并至CP-2026-06-00001处理，本记录豁免。',
    bimNote: 'F1-04轴/B轴 暖通风管 BIM备注：送风风管1000x400与喷淋干管重叠，与CP-2026-06-00001相同。',
    bimNoteV2: null as string | null,
    boundary: '边界样本：X=6200,Y=3100;风管底标高+3.850；喷淋管DN150标高+3.800。',
    verbal: '口头说明：阿宁说这条和CP-2026-06-00001是同一问题，不要重复开单。',
    engineerOps: [
      { who: ENGINEER_A, type: 'abnormal' as const, detail: '张工标记为异常（重复碰撞点），填写异常原因：与CP-2026-06-00001重复，不重复处理。', reason: '同一构件同一问题，属重复记录' },
      { who: ENGINEER_A, type: 'conclusion' as const, detail: '张工改判结论：豁免，合并至CP-2026-06-00001。', reason: '重复碰撞点合并处理' },
      { who: ENGINEER_A, type: 'status' as const, detail: '张工改状态：processing→waived。' },
    ],
  },
  {
    id: formatCollisionSeq(4),
    floor: 'B2',
    discipline: '建筑',
    status: 'resolved' as const,
    isAbnormal: false,
    remark: '墙体留洞尺寸调整，已出变更单。',
    conclusion: '将建筑留洞从600x600扩大为800x800，已签变更B2-BG-017。',
    bimNote: 'B2-03轴/A轴 建筑墙体 BIM备注：人防隔墙预留洞口600x600，机电专业反馈不够，需放大。',
    bimNoteV2: null as string | null,
    boundary: '边界样本：人防墙厚400；原洞中心标高-4.600；相关风管700x500穿洞。',
    verbal: null as string | null,
    engineerOps: [
      { who: ENGINEER_A, type: 'remark' as const, detail: '张工（白班）备注：需等设计院回复留洞放大尺寸。' },
    ],
    nightOps: [
      { who: ENGINEER_B, type: 'material_add' as const, detail: '李工（夜班）补录设计院口头说明：阿宁23:15微信确认，留洞放大至800x800。' },
      { who: ENGINEER_B, type: 'conclusion' as const, detail: '李工（夜班）改判结论：留洞扩大为800x800，签变更B2-BG-017。', reason: '设计院助理阿宁23:15口头确认' },
      { who: ENGINEER_B, type: 'status' as const, detail: '李工（夜班）改状态：processing→resolved。' },
    ],
  },
];

const collisions: Collision[] = [];
const snapshots: VersionSnapshot[] = [];
const materials: Material[] = [];
const audits: AuditLog[] = [];

function pushAudit(
  collisionId: string,
  who: { id: string; name: string },
  changeType: string,
  detail: string,
  reason?: string,
  ts?: string,
) {
  const meta = changeTypeLabel(changeType);
  audits.push({
    id: uid('AL-'),
    collisionId,
    action: meta.label,
    actionBadgeColor: meta.color,
    operator: who.id,
    operatorName: who.name,
    timestamp: ts ?? nowISO(),
    reason,
    detail,
  });
}

function makeSnapshot(
  c: Collision,
  who: { id: string; name: string },
  changeType: VersionSnapshot['changeType'],
  reason: string | undefined,
  fieldDiffs: ReturnType<typeof diffFields>,
  ts: string,
  overrideVersion?: number,
): VersionSnapshot {
  const curCount = snapshots.filter((s) => s.collisionId === c.id).length;
  return {
    id: uid('VS-'),
    collisionId: c.id,
    version: overrideVersion ?? curCount + 1,
    changedBy: who.id,
    changedByName: who.name,
    changedAt: ts,
    changeType,
    changeReason: reason,
    fieldDiffs,
    snapshot: { ...c },
  };
}

// 处理 4 条核心场景
for (let i = 0; i < scenarios.length; i++) {
  const s = scenarios[i];
  const ts0 = shiftTime(baseTime.toISOString(), i * 6);

  const coll: Collision = {
    id: s.id,
    coordinateX: randInt(3000, 20000),
    coordinateY: randInt(2000, 15000),
    coordinateZ: randInt(-6000, 12000),
    floor: s.floor,
    discipline: s.discipline,
    status: 'pending',
    conclusion: '',
    remark: '',
    isAbnormal: false,
    abnormalReason: undefined,
    cameraPosition: { px: randInt(500, 3000), py: randInt(500, 3000), pz: randInt(200, 2000) },
    cameraTarget: { tx: randInt(3000, 20000), ty: randInt(2000, 15000), tz: randInt(-6000, 12000) },
    cameraFov: randInt(45, 75),
    screenshotUrl:
      'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1200&q=60',
    createdBy: DESIGNER.id,
    createdByName: DESIGNER.name,
    createdAt: ts0,
    lastModifiedBy: DESIGNER.id,
    lastModifiedByName: DESIGNER.name,
    lastModifiedAt: ts0,
    version: 1,
  };
  collisions.push(coll);

  // 初始材料（阿宁提交）
  const bimV1: Material = {
    id: uid('MT-'),
    collisionId: coll.id,
    type: 'bim_note',
    typeLabel: materialTypeLabel('bim_note'),
    content: s.bimNote,
    md5: md5(s.bimNote),
    uploader: DESIGNER.id,
    uploaderName: DESIGNER.name,
    uploadedAt: ts0,
    version: 1,
    previousId: undefined,
    isModifiedSinceLast: false,
  };
  materials.push(bimV1);
  pushAudit(coll.id, DESIGNER, 'material_add', '阿宁上传BIM模型备注（v1）', undefined, ts0);

  if (s.boundary) {
    materials.push({
      id: uid('MT-'),
      collisionId: coll.id,
      type: 'boundary_sample',
      typeLabel: materialTypeLabel('boundary_sample'),
      content: s.boundary,
      md5: md5(s.boundary),
      uploader: DESIGNER.id,
      uploaderName: DESIGNER.name,
      uploadedAt: shiftTime(ts0, 0.2),
      version: 1,
      previousId: undefined,
      isModifiedSinceLast: false,
    });
    pushAudit(coll.id, DESIGNER, 'material_add', '阿宁上传边界样本', undefined, shiftTime(ts0, 0.2));
  }
  if (s.verbal) {
    materials.push({
      id: uid('MT-'),
      collisionId: coll.id,
      type: 'verbal_note',
      typeLabel: materialTypeLabel('verbal_note'),
      content: s.verbal,
      md5: md5(s.verbal),
      uploader: DESIGNER.id,
      uploaderName: DESIGNER.name,
      uploadedAt: shiftTime(ts0, 0.5),
      version: 1,
      previousId: undefined,
      isModifiedSinceLast: false,
    });
    pushAudit(coll.id, DESIGNER, 'material_add', '阿宁上传口头说明', undefined, shiftTime(ts0, 0.5));
  }

  snapshots.push(
    makeSnapshot(
      coll,
      DESIGNER,
      'remark',
      '阿宁提交初始材料',
      [{ field: '(创建)', oldValue: null, newValue: '初始记录 v1' }],
      ts0,
      1,
    ),
  );

  // BIM v2（改口径）
  if (s.bimNoteV2) {
    const tsV2 = shiftTime(ts0, 4);
    const prevBim = bimV1;
    const bimV2Mat: Material = {
      id: uid('MT-'),
      collisionId: coll.id,
      type: 'bim_note',
      typeLabel: materialTypeLabel('bim_note'),
      content: s.bimNoteV2,
      md5: md5(s.bimNoteV2),
      uploader: DESIGNER.id,
      uploaderName: DESIGNER.name,
      uploadedAt: tsV2,
      version: 2,
      previousId: prevBim.id,
      isModifiedSinceLast: true,
    };
    materials.push(bimV2Mat);
    pushAudit(
      coll.id,
      DESIGNER,
      'material_modify',
      `阿宁修改BIM备注口径（v1→v2），MD5 ${prevBim.md5.slice(-4)}→${bimV2Mat.md5.slice(-4)}`,
      '现场复核后偏移量有误，更正为250mm',
      tsV2,
    );
    coll.version = 2;
    coll.lastModifiedAt = tsV2;
    coll.lastModifiedBy = DESIGNER.id;
    snapshots.push(
      makeSnapshot(
        coll,
        DESIGNER,
        'material_modify',
        '现场复核后偏移量有误，更正为250mm',
        diffFields({ content: prevBim.content }, { content: bimV2Mat.content }, ['content']),
        tsV2,
        2,
      ),
    );
  }

  // 白班张工操作
  for (const op of s.engineerOps ?? []) {
    const ts = shiftTime(coll.lastModifiedAt, 1);
    const before = { ...coll };
    if (op.type === 'remark') {
      const p = op.detail.indexOf('：');
      coll.remark = p > -1 ? op.detail.slice(p + 1) : op.detail;
    }
    if (op.type === 'conclusion') {
      const p = op.detail.indexOf('：');
      coll.conclusion = p > -1 ? op.detail.slice(p + 1) : op.detail;
    }
    if (op.type === 'status') {
      const m = /(\w+)\s*→\s*(\w+)/.exec(op.detail);
      if (m) coll.status = m[2] as Collision['status'];
    }
    if (op.type === 'abnormal') {
      coll.isAbnormal = true;
      coll.abnormalReason = (s as any).abnormalReason;
    }
    coll.lastModifiedBy = op.who.id;
    coll.lastModifiedByName = op.who.name;
    coll.lastModifiedAt = ts;
    coll.version += 1;
    const diffs = diffFields(before as any, coll as any, [
      'remark',
      'conclusion',
      'status',
      'isAbnormal',
      'abnormalReason',
      'version',
    ]);
    snapshots.push(
      makeSnapshot(coll, op.who, (op.type as any) === 'abnormal' ? 'abnormal' : (op.type as any), (op as any).reason, diffs, ts, coll.version),
    );
    pushAudit(coll.id, op.who, op.type, op.detail, (op as any).reason, ts);
  }

  // 夜班李工操作
  for (const op of (s as any).nightOps ?? []) {
    const ts = shiftTime(coll.lastModifiedAt, 5);
    const before = { ...coll };
    if (op.type === 'material_add') {
      const p = op.detail.indexOf('补录');
      const content = p > -1 ? op.detail.slice(p + 2) : op.detail;
      materials.push({
        id: uid('MT-'),
        collisionId: coll.id,
        type: 'supplement',
        typeLabel: materialTypeLabel('supplement'),
        content,
        md5: md5(content),
        uploader: op.who.id,
        uploaderName: op.who.name,
        uploadedAt: ts,
        version: 1,
        previousId: undefined,
        isModifiedSinceLast: false,
      });
    }
    if (op.type === 'conclusion') {
      const p = op.detail.indexOf('：');
      coll.conclusion = p > -1 ? op.detail.slice(p + 1) : op.detail;
    }
    if (op.type === 'status') {
      const m = /(\w+)\s*→\s*(\w+)/.exec(op.detail);
      if (m) coll.status = m[2] as Collision['status'];
    }
    coll.lastModifiedBy = op.who.id;
    coll.lastModifiedByName = op.who.name;
    coll.lastModifiedAt = ts;
    coll.version += 1;
    let diffs = diffFields(before as any, coll as any, ['remark', 'conclusion', 'status', 'isAbnormal', 'abnormalReason', 'version']);
    if (diffs.length === 0 && op.type === 'material_add') {
      diffs = [{ field: 'material', oldValue: null, newValue: '补录材料' }];
    }
    snapshots.push(
      makeSnapshot(coll, op.who, op.type, (op as any).reason, diffs, ts, coll.version),
    );
    pushAudit(coll.id, op.who, op.type, op.detail, (op as any).reason, ts);
  }
  collisions[i] = coll;
}

// 再生成 8 条随机碰撞点
for (let i = 0; i < 8; i++) {
  const seq = 5 + i;
  const id = formatCollisionSeq(seq);
  const ts0 = shiftTime(baseTime.toISOString(), seq * 2);
  const coll: Collision = {
    id,
    coordinateX: randInt(3000, 20000),
    coordinateY: randInt(2000, 15000),
    coordinateZ: randInt(-6000, 12000),
    floor: rand(FLOORS),
    discipline: rand(DISCIPLINES),
    status: rand(STATUSES),
    conclusion: rand([
      '已通过设计院复核，按变更单处理',
      '待设计回复',
      '现场调整后满足规范',
      '施工误差范围内，豁免',
    ]),
    remark: rand(['算法复核通过', '等待现场补充', '与施工队沟通中', '已同步给设计院']),
    isAbnormal: false,
    cameraPosition: { px: randInt(500, 3000), py: randInt(500, 3000), pz: randInt(200, 2000) },
    cameraTarget: { tx: randInt(3000, 20000), ty: randInt(2000, 15000), tz: randInt(-6000, 12000) },
    cameraFov: randInt(45, 75),
    screenshotUrl:
      'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1200&q=60',
    createdBy: DESIGNER.id,
    createdByName: DESIGNER.name,
    createdAt: ts0,
    lastModifiedBy: rand([ENGINEER_A.id, ENGINEER_B.id, DESIGNER.id]),
    lastModifiedByName: rand([ENGINEER_A.name, ENGINEER_B.name, DESIGNER.name]),
    lastModifiedAt: shiftTime(ts0, 3),
    version: randInt(1, 3),
  };
  collisions.push(coll);
  for (const t of [
    { type: 'bim_note' as const, c: `${coll.floor}层 ${coll.discipline}专业 构件碰撞BIM备注。` },
    { type: 'boundary_sample' as const, c: `边界样本：坐标X=${coll.coordinateX},Y=${coll.coordinateY},Z=${coll.coordinateZ}` },
  ]) {
    materials.push({
      id: uid('MT-'),
      collisionId: coll.id,
      type: t.type,
      typeLabel: materialTypeLabel(t.type),
      content: t.c,
      md5: md5(t.c),
      uploader: DESIGNER.id,
      uploaderName: DESIGNER.name,
      uploadedAt: ts0,
      version: 1,
      isModifiedSinceLast: false,
    });
  }
  snapshots.push({
    id: uid('VS-'),
    collisionId: coll.id,
    version: 1,
    changedBy: DESIGNER.id,
    changedByName: DESIGNER.name,
    changedAt: ts0,
    changeType: 'remark',
    fieldDiffs: [{ field: '(创建)', oldValue: null, newValue: '初始记录 v1' }],
    snapshot: { ...coll },
  });
  pushAudit(coll.id, DESIGNER, 'material_add', '阿宁提交材料并创建碰撞点记录 v1', undefined, ts0);
  if (coll.version > 1) {
    snapshots.push({
      id: uid('VS-'),
      collisionId: coll.id,
      version: 2,
      changedBy: ENGINEER_A.id,
      changedByName: ENGINEER_A.name,
      changedAt: shiftTime(ts0, 2),
      changeType: 'remark',
      fieldDiffs: [{ field: 'remark', oldValue: '', newValue: coll.remark }],
      snapshot: { ...coll },
    });
    pushAudit(coll.id, ENGINEER_A, 'remark', `张工补充备注：${coll.remark}`, undefined, shiftTime(ts0, 2));
  }
}

// 重置并写入
db.reset();
for (const c of collisions) collisionRepo.insert(c);
for (const m of materials) {
  const { typeLabel, isModifiedSinceLast, ...rest } = m;
  materialRepo.insert(rest);
}
for (const s of snapshots) versionRepo.insert(s);
for (const a of audits) auditRepo.insert(a);

console.log(`[seed] 完成：
  碰撞点 ${collisions.length} 条
  材料 ${materials.length} 份
  版本快照 ${snapshots.length} 条
  审计日志 ${audits.length} 条

  典型场景：
  - ${scenarios[1].id}：阿宁修改BIM备注口径（v1→v2），可看到"改口径"标记
  - ${scenarios[2].id}：重复碰撞点，被标记异常并豁免
  - ${scenarios[3].id}：夜班李工补录材料+改判（交接班追溯场景）
`);
