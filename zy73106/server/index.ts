import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

type UserRole = 'engineer' | 'manager' | 'viewer';

interface User {
  id: string;
  name: string;
  role: UserRole;
  avatar: string;
}

type DrawingStatus = 'normal' | 'abnormal' | 'reviewing' | 'closed';

interface DrawingVersion {
  id: string;
  drawingId: string;
  version: string;
  uploadedBy: string;
  uploadedAt: string;
  isLatest: boolean;
  fileName: string;
  fileSize: number;
  changeLog: string;
}

type NoteTag = 'initial' | 'supplement' | 'review' | 'fix';

interface NoteBlock {
  id: string;
  drawingId: string;
  versionId: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  tag: NoteTag;
  isRawBimClue: boolean;
}

interface MaterialBatch {
  id: string;
  drawingId: string;
  batchNo: string;
  materialName: string;
  isMissing: boolean;
  reviewHint?: string;
  suppliedAt?: string;
  recordedBy: string;
}

interface ValueChangeLog {
  id: string;
  drawingId: string;
  fieldName: string;
  fieldLabel: string;
  oldValue: number;
  newValue: number;
  reason: string;
  operatorId: string;
  operatorName: string;
  changedAt: string;
}

interface DrawingMetrics {
  collisionPoints: number;
  unqualifiedItems: number;
  sunShadowRisk: number;
  volumeDeviation: number;
}

interface Drawing {
  id: string;
  projectNo: string;
  name: string;
  buildingName: string;
  status: DrawingStatus;
  currentVersionId: string;
  metrics: DrawingMetrics;
  createdAt: string;
  updatedAt: string;
}

interface ExportLog {
  id: string;
  type: 'pdf' | 'csv' | 'json';
  drawingId?: string;
  operatorName: string;
  exportedAt: string;
  fileName: string;
}

interface Db {
  currentUser: User;
  users: User[];
  drawings: Drawing[];
  versions: DrawingVersion[];
  notes: NoteBlock[];
  materials: MaterialBatch[];
  changeLogs: ValueChangeLog[];
  exportLogs: ExportLog[];
}

const D = (daysAgo: number, hour = 10, min = 0): string => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, min, 0, 0);
  return d.toISOString();
};

const userManager: User = {
  id: 'u-mgr-001',
  name: '陈建国',
  role: 'manager',
  avatar: '陈',
};

const userEngineer: User = {
  id: 'u-eng-001',
  name: '叶华明',
  role: 'engineer',
  avatar: '叶',
};

const userEngineer2: User = {
  id: 'u-eng-002',
  name: '王晓峰',
  role: 'engineer',
  avatar: '王',
};

const SEED_DB: Db = {
  currentUser: userManager,
  users: [userManager, userEngineer, userEngineer2],
  drawings: [
    {
      id: 'd-001',
      projectNo: 'BIM-2026-017',
      name: 'T3塔楼标准层结构日照体量',
      buildingName: 'T3 塔楼 / 3-48F',
      status: 'abnormal',
      currentVersionId: 'v-001-v1',
      metrics: { collisionPoints: 5, unqualifiedItems: 2, sunShadowRisk: 3, volumeDeviation: 2.1 },
      createdAt: D(28, 9, 15),
      updatedAt: D(1, 16, 42),
    },
    {
      id: 'd-002',
      projectNo: 'BIM-2026-017',
      name: 'T2塔楼地下室碰撞检查',
      buildingName: 'T2 塔楼 / B3-B1',
      status: 'reviewing',
      currentVersionId: 'v-002-v1',
      metrics: { collisionPoints: 8, unqualifiedItems: 4, sunShadowRisk: 0, volumeDeviation: 1.5 },
      createdAt: D(21, 14, 0),
      updatedAt: D(2, 11, 10),
    },
    {
      id: 'd-003',
      projectNo: 'BIM-2026-009',
      name: '商业裙房屋顶日照分析',
      buildingName: 'S1 裙房 / RF',
      status: 'normal',
      currentVersionId: 'v-003-v2',
      metrics: { collisionPoints: 0, unqualifiedItems: 0, sunShadowRisk: 1, volumeDeviation: 0.3 },
      createdAt: D(45, 10, 30),
      updatedAt: D(7, 15, 0),
    },
    {
      id: 'd-004',
      projectNo: 'BIM-2026-021',
      name: 'T1办公楼核心筒体量',
      buildingName: 'T1 办公楼 / 5-35F',
      status: 'closed',
      currentVersionId: 'v-004-v1',
      metrics: { collisionPoints: 0, unqualifiedItems: 0, sunShadowRisk: 0, volumeDeviation: 0.8 },
      createdAt: D(60, 8, 45),
      updatedAt: D(14, 17, 20),
    },
    {
      id: 'd-005',
      projectNo: 'BIM-2026-017',
      name: 'T3连廊钢结构碰撞',
      buildingName: 'T2-T3 连廊 / 20F',
      status: 'abnormal',
      currentVersionId: 'v-005-v1',
      metrics: { collisionPoints: 12, unqualifiedItems: 6, sunShadowRisk: 0, volumeDeviation: 3.7 },
      createdAt: D(5, 13, 0),
      updatedAt: D(0, 9, 30),
    },
  ],
  versions: [
    { id: 'v-001-v1', drawingId: 'd-001', version: 'V1.0', uploadedBy: '叶华明', uploadedAt: D(2, 9, 0), isLatest: true, fileName: 'T3-标准层-V1.0.rvt', fileSize: 48_320_000, changeLog: '修正4处梁高冲突，更新日照阴影计算模型' },
    { id: 'v-001-v09', drawingId: 'd-001', version: 'V0.9', uploadedBy: '叶华明', uploadedAt: D(10, 15, 0), isLatest: false, fileName: 'T3-标准层-V0.9.rvt', fileSize: 47_180_000, changeLog: '初版提交，待复核碰撞点' },
    { id: 'v-002-v1', drawingId: 'd-002', version: 'V1.0', uploadedBy: '王晓峰', uploadedAt: D(3, 11, 0), isLatest: true, fileName: 'T2-地下室-V1.0.rvt', fileSize: 62_410_000, changeLog: '新增人防门节点，更新材料批次' },
    { id: 'v-003-v2', drawingId: 'd-003', version: 'V2.0', uploadedBy: '叶华明', uploadedAt: D(7, 14, 0), isLatest: true, fileName: 'S1-屋顶-V2.0.rvt', fileSize: 21_500_000, changeLog: '遮阳板角度调整至35度' },
    { id: 'v-003-v1', drawingId: 'd-003', version: 'V1.0', uploadedBy: '叶华明', uploadedAt: D(45, 10, 0), isLatest: false, fileName: 'S1-屋顶-V1.0.rvt', fileSize: 20_900_000, changeLog: '初版' },
    { id: 'v-004-v1', drawingId: 'd-004', version: 'V1.0', uploadedBy: '王晓峰', uploadedAt: D(60, 8, 0), isLatest: true, fileName: 'T1-核心筒-V1.0.rvt', fileSize: 35_220_000, changeLog: '已闭环，签字版' },
    { id: 'v-005-v1', drawingId: 'd-005', version: 'V1.0', uploadedBy: '叶华明', uploadedAt: D(5, 13, 0), isLatest: true, fileName: '连廊-钢构-V1.0.rvt', fileSize: 15_800_000, changeLog: '初版，碰撞点较多待处理' },
  ],
  notes: [
    { id: 'n-001', drawingId: 'd-001', versionId: 'v-001-v09', content: 'BIM模型导出：3-12F东向碰撞共12处，集中在L4梁与幕墙龙骨交叉位置。日照阴影14:30后覆盖北侧绿地约120㎡。', authorId: userEngineer.id, authorName: userEngineer.name, createdAt: D(10, 15, 30), tag: 'initial', isRawBimClue: true },
    { id: 'n-002', drawingId: 'd-001', versionId: 'v-001-v09', content: '补充材料批次缺失说明：B3批次高强度螺栓未进场（合同号HT-2026-089），预计6月12日到货。接手人请先核对到货清单再继续复核。', authorId: userEngineer2.id, authorName: userEngineer2.name, createdAt: D(8, 10, 20), tag: 'supplement', isRawBimClue: false },
    { id: 'n-003', drawingId: 'd-001', versionId: 'v-001-v1', content: 'V1.0模型更新后复算：碰撞点从12降至5。L4梁截面下调50mm通过。北侧绿地日照阴影缩减至87㎡，仍超出规范3㎡。', authorId: userEngineer.id, authorName: userEngineer.name, createdAt: D(2, 9, 45), tag: 'fix', isRawBimClue: false },
    { id: 'n-004', drawingId: 'd-001', versionId: 'v-001-v1', content: '复核意见：阴影超标3㎡属临界，建议景观侧补种落叶乔木。碰撞点剩余5处需结构确认避让可行性。本周三前提修改方案。', authorId: userManager.id, authorName: userManager.name, createdAt: D(1, 16, 50), tag: 'review', isRawBimClue: false },
    { id: 'n-005', drawingId: 'd-002', versionId: 'v-002-v1', content: 'BIM模型导出：B2层人防区8处管道与结构梁冲突，B3集水坑位置偏移。不合格项含2处材料等级不匹配。', authorId: userEngineer2.id, authorName: userEngineer2.name, createdAt: D(3, 11, 30), tag: 'initial', isRawBimClue: true },
    { id: 'n-006', drawingId: 'd-002', versionId: 'v-002-v1', content: '后补：人防门厂家返回节点图3张，见附件DOOR-2026-045~047。与原模型差异在门框埋件，已同步更新材料批次记录。', authorId: userEngineer2.id, authorName: userEngineer2.name, createdAt: D(2, 14, 15), tag: 'supplement', isRawBimClue: false },
    { id: 'n-007', drawingId: 'd-002', versionId: 'v-002-v1', content: '复核中：管道走向调整方案已定，需等人防办6月13日会议结论。材料等级匹配项待采购确认替换规格。', authorId: userManager.id, authorName: userManager.name, createdAt: D(2, 11, 10), tag: 'review', isRawBimClue: false },
    { id: 'n-008', drawingId: 'd-003', versionId: 'v-003-v2', content: '调整遮阳板角度至35度后，夏季正午底层商铺外廊日照时长由1.2h提升至2.8h，满足商业规范下限3h（差0.2h景观辅助解决）。', authorId: userEngineer.id, authorName: userEngineer.name, createdAt: D(7, 15, 0), tag: 'fix', isRawBimClue: false },
    { id: 'n-009', drawingId: 'd-003', versionId: 'v-003-v1', content: 'BIM初版：遮阳板30度时底层全日照不足1.5h，严重不达标。', authorId: userEngineer.id, authorName: userEngineer.name, createdAt: D(45, 10, 30), tag: 'initial', isRawBimClue: true },
    { id: 'n-010', drawingId: 'd-004', versionId: 'v-004-v1', content: 'BIM导出：核心筒剪力墙与机电管线零碰撞，体量偏差0.8%在允许范围。日照阴影对周边住宅无超标。', authorId: userEngineer2.id, authorName: userEngineer2.name, createdAt: D(60, 8, 50), tag: 'initial', isRawBimClue: true },
    { id: 'n-011', drawingId: 'd-004', versionId: 'v-004-v1', content: '复核通过。签字版归档。封账状态：已闭环。', authorId: userManager.id, authorName: userManager.name, createdAt: D(14, 17, 20), tag: 'review', isRawBimClue: false },
    { id: 'n-012', drawingId: 'd-005', versionId: 'v-005-v1', content: 'BIM导出：连廊主桁架与T2挑檐碰撞12处，斜腹杆与幕墙节点冲突6处。材料：Q345GJ钢板批次B7、B9缺失，现场等待约10天。', authorId: userEngineer.id, authorName: userEngineer.name, createdAt: D(5, 13, 30), tag: 'initial', isRawBimClue: true },
    { id: 'n-013', drawingId: 'd-005', versionId: 'v-005-v1', content: '补充说明：钢板批次B7（合同HT-26-112）钢厂延期6月15日交货；B9批次（HT-26-117）检测报告未出，预计6月18日可取。接手人务必确认材料到位后方可吊装。', authorId: userEngineer.id, authorName: userEngineer.name, createdAt: D(3, 17, 0), tag: 'supplement', isRawBimClue: false },
    { id: 'n-014', drawingId: 'd-005', versionId: 'v-005-v1', content: '初核意见：碰撞点数量过高，建议设计院先出节点优化方案。材料缺料问题请采购同步更新进度，下周早会重点过。', authorId: userManager.id, authorName: userManager.name, createdAt: D(0, 9, 30), tag: 'review', isRawBimClue: false },
  ],
  materials: [
    { id: 'm-001', drawingId: 'd-001', batchNo: 'B-2026-089', materialName: '10.9级高强度螺栓 M24', isMissing: true, reviewHint: '缺失待补，6月12日到货，接手请核到货单', recordedBy: userEngineer2.name, suppliedAt: undefined },
    { id: 'm-002', drawingId: 'd-001', batchNo: 'B-2026-077', materialName: 'HRB400E 梁主筋 Φ32', isMissing: false, recordedBy: userEngineer.name, suppliedAt: D(12, 0, 0) },
    { id: 'm-003', drawingId: 'd-002', batchNo: 'R-2026-045', materialName: '人防密闭门 FM-1220', isMissing: false, recordedBy: userEngineer2.name, suppliedAt: D(4, 0, 0) },
    { id: 'm-004', drawingId: 'd-002', batchNo: 'R-2026-048', materialName: '人防门埋件钢板 20mm', isMissing: true, reviewHint: '厂家补发中，与门框节点图同步', recordedBy: userEngineer2.name, suppliedAt: undefined },
    { id: 'm-005', drawingId: 'd-003', batchNo: 'S-2026-012', materialName: '遮阳板铝合金型材 6063-T5', isMissing: false, recordedBy: userEngineer.name, suppliedAt: D(10, 0, 0) },
    { id: 'm-006', drawingId: 'd-005', batchNo: 'B7-HT-26-112', materialName: 'Q345GJ 钢板 t=40mm', isMissing: true, reviewHint: '钢厂延期，6月15日交货，吊装前必核', recordedBy: userEngineer.name, suppliedAt: undefined },
    { id: 'm-007', drawingId: 'd-005', batchNo: 'B9-HT-26-117', materialName: 'Q345GJ 钢板 t=50mm', isMissing: true, reviewHint: '第三方检测未出，6月18日取报告后放行', recordedBy: userEngineer.name, suppliedAt: undefined },
    { id: 'm-008', drawingId: 'd-005', batchNo: 'B8-HT-26-115', materialName: 'Q345GJ 钢板 t=30mm', isMissing: false, recordedBy: userEngineer.name, suppliedAt: D(2, 0, 0) },
  ],
  changeLogs: [
    { id: 'c-001', drawingId: 'd-001', fieldName: 'collisionPoints', fieldLabel: '碰撞点数', oldValue: 12, newValue: 5, reason: 'V1.0下调L4梁截面50mm，消除7处冲突', operatorId: userEngineer.id, operatorName: userEngineer.name, changedAt: D(2, 9, 45) },
    { id: 'c-002', drawingId: 'd-001', fieldName: 'unqualifiedItems', fieldLabel: '不合格项', oldValue: 4, newValue: 2, reason: '2处材料等级问题由设计变更覆盖', operatorId: userEngineer.id, operatorName: userEngineer.name, changedAt: D(2, 10, 0) },
    { id: 'c-003', drawingId: 'd-001', fieldName: 'sunShadowRisk', fieldLabel: '日照阴影风险', oldValue: 5, newValue: 3, reason: '遮阳角度微调模型复算', operatorId: userEngineer.id, operatorName: userEngineer.name, changedAt: D(2, 10, 15) },
    { id: 'c-004', drawingId: 'd-002', fieldName: 'unqualifiedItems', fieldLabel: '不合格项', oldValue: 6, newValue: 4, reason: '人防门节点更新消除2处等级问题', operatorId: userEngineer2.id, operatorName: userEngineer2.name, changedAt: D(2, 14, 20) },
    { id: 'c-005', drawingId: 'd-003', fieldName: 'sunShadowRisk', fieldLabel: '日照阴影风险', oldValue: 4, newValue: 1, reason: '遮阳板角度从30°调整至35°', operatorId: userEngineer.id, operatorName: userEngineer.name, changedAt: D(7, 15, 0) },
    { id: 'c-006', drawingId: 'd-003', fieldName: 'volumeDeviation', fieldLabel: '体量偏差(%)', oldValue: 1.2, newValue: 0.3, reason: '遮阳板微调引起体量重算', operatorId: userEngineer.id, operatorName: userEngineer.name, changedAt: D(7, 15, 5) },
    { id: 'c-007', drawingId: 'd-005', fieldName: 'collisionPoints', fieldLabel: '碰撞点数', oldValue: 0, newValue: 12, reason: '初版模型导入计算完成', operatorId: userEngineer.id, operatorName: userEngineer.name, changedAt: D(5, 13, 30) },
    { id: 'c-008', drawingId: 'd-005', fieldName: 'unqualifiedItems', fieldLabel: '不合格项', oldValue: 0, newValue: 6, reason: '初版导入：6处材料缺料标记', operatorId: userEngineer.id, operatorName: userEngineer.name, changedAt: D(5, 13, 31) },
    { id: 'c-009', drawingId: 'd-005', fieldName: 'volumeDeviation', fieldLabel: '体量偏差(%)', oldValue: 0, newValue: 3.7, reason: '连廊节点误差累积', operatorId: userEngineer.id, operatorName: userEngineer.name, changedAt: D(5, 13, 32) },
    { id: 'c-010', drawingId: 'd-001', fieldName: 'collisionPoints', fieldLabel: '碰撞点数', oldValue: 0, newValue: 12, reason: 'V0.9初版BIM模型计算导入', operatorId: userEngineer.id, operatorName: userEngineer.name, changedAt: D(10, 15, 35) },
    { id: 'c-011', drawingId: 'd-002', fieldName: 'collisionPoints', fieldLabel: '碰撞点数', oldValue: 0, newValue: 8, reason: '初版模型导入', operatorId: userEngineer2.id, operatorName: userEngineer2.name, changedAt: D(3, 11, 30) },
    { id: 'c-012', drawingId: 'd-004', fieldName: 'collisionPoints', fieldLabel: '碰撞点数', oldValue: 2, newValue: 0, reason: '设计变更单DC-087消除冲突', operatorId: userEngineer2.id, operatorName: userEngineer2.name, changedAt: D(20, 10, 0) },
  ],
  exportLogs: [
    { id: 'e-001', type: 'pdf', drawingId: 'd-004', operatorName: '陈建国', exportedAt: D(14, 17, 35), fileName: 'T1-核心筒-预审报告-20260527.pdf' },
    { id: 'e-002', type: 'csv', operatorName: '叶华明', exportedAt: D(7, 16, 0), fileName: '全项目预审汇总-20260603.csv' },
    { id: 'e-003', type: 'pdf', drawingId: 'd-003', operatorName: '陈建国', exportedAt: D(7, 16, 10), fileName: 'S1裙房屋顶-预审报告-20260603.pdf' },
  ],
};

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const uid = (prefix: string): string => {
  return prefix + '-' + Math.random().toString(16).slice(2, 10);
};

const nowIso = (): string => new Date().toISOString();

const readDb = (): Db => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(SEED_DB, null, 2), 'utf-8');
    return JSON.parse(JSON.stringify(SEED_DB));
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
};

const writeDb = (db: Db): void => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
};

const METRIC_FIELD_LABELS: Record<string, string> = {
  collisionPoints: '碰撞点数',
  unqualifiedItems: '不合格项',
  sunShadowRisk: '日照阴影风险',
  volumeDeviation: '体量偏差(%)',
};

const app = express();
app.use(cors());
app.use(express.json());

interface ApiResponse {
  ok: boolean;
  data?: any;
  error?: string;
}

const ok = (data?: any): ApiResponse => ({ ok: true, data });
const err = (error: string): ApiResponse => ({ ok: false, error });

app.get('/api/drawings', (req, res) => {
  const db = readDb();
  const result = db.drawings.map((d) => {
    const dNotes = db.notes.filter((n) => n.drawingId === d.id);
    const dVersions = db.versions.filter((v) => v.drawingId === d.id);
    const dMaterials = db.materials.filter((m) => m.drawingId === d.id);
    const abnormalCount =
      d.metrics.collisionPoints + d.metrics.unqualifiedItems + d.metrics.sunShadowRisk;
    const reviewCount = dNotes.filter((n) => n.tag === 'review' || n.tag === 'fix').length;
    const missingCount = dMaterials.filter((m) => m.isMissing).length;
    const latestNote = dNotes
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    const latestVersion = dVersions.find((v) => v.id === d.currentVersionId);
    return {
      ...d,
      abnormalCount,
      reviewCount,
      missingCount,
      latestNote: latestNote ?? null,
      latestVersion: latestVersion ?? null,
    };
  });
  res.json(ok(result));
});

app.get('/api/drawings/:id', (req, res) => {
  const db = readDb();
  const drawing = db.drawings.find((d) => d.id === req.params.id);
  if (!drawing) {
    res.status(404).json(err('图纸不存在'));
    return;
  }
  const versions = db.versions.filter((v) => v.drawingId === drawing.id);
  const notes = db.notes
    .filter((n) => n.drawingId === drawing.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const materials = db.materials.filter((m) => m.drawingId === drawing.id);
  const changeLogs = db.changeLogs
    .filter((c) => c.drawingId === drawing.id)
    .sort((a, b) => b.changedAt.localeCompare(a.changedAt));
  res.json(ok({ drawing, versions, notes, materials, changeLogs }));
});

app.post('/api/drawings/:id/notes', (req, res) => {
  const db = readDb();
  const drawing = db.drawings.find((d) => d.id === req.params.id);
  if (!drawing) {
    res.status(404).json(err('图纸不存在'));
    return;
  }
  const currentVersion = db.versions.find((v) => v.id === drawing.currentVersionId);
  if (!currentVersion || !currentVersion.isLatest) {
    res.status(400).json(err('只能给当前最新版本添加备注'));
    return;
  }
  const { content, tag, isRawBimClue, authorId, authorName } = req.body;
  if (!content || !tag || !authorId || !authorName) {
    res.status(400).json(err('缺少必填字段'));
    return;
  }
  const now = nowIso();
  const newNote: NoteBlock = {
    id: uid('n'),
    drawingId: drawing.id,
    versionId: currentVersion.id,
    content,
    tag,
    isRawBimClue: isRawBimClue ?? false,
    authorId,
    authorName,
    createdAt: now,
  };
  db.notes.push(newNote);
  drawing.updatedAt = now;

  const changeLog: ValueChangeLog = {
    id: uid('c'),
    drawingId: drawing.id,
    fieldName: 'noteAdded',
    fieldLabel: '新增备注',
    oldValue: 0,
    newValue: 1,
    reason: content.slice(0, 30),
    operatorId: authorId,
    operatorName: authorName,
    changedAt: now,
  };
  db.changeLogs.push(changeLog);

  writeDb(db);
  res.json(ok(newNote));
});

app.delete('/api/drawings/:id/notes/:noteId', (req, res) => {
  const db = readDb();
  const drawing = db.drawings.find((d) => d.id === req.params.id);
  if (!drawing) {
    res.status(404).json(err('图纸不存在'));
    return;
  }
  const noteIndex = db.notes.findIndex((n) => n.id === req.params.noteId);
  if (noteIndex === -1) {
    res.status(404).json(err('备注不存在'));
    return;
  }
  const note = db.notes[noteIndex];
  if (note.isRawBimClue) {
    res.status(403).json(err('BIM原始线索不可删除'));
    return;
  }
  db.notes.splice(noteIndex, 1);
  const now = nowIso();
  drawing.updatedAt = now;

  const changeLog: ValueChangeLog = {
    id: uid('c'),
    drawingId: drawing.id,
    fieldName: 'noteDeleted',
    fieldLabel: '删除备注',
    oldValue: 1,
    newValue: 0,
    reason: note.content.slice(0, 30),
    operatorId: note.authorId,
    operatorName: note.authorName,
    changedAt: now,
  };
  db.changeLogs.push(changeLog);

  writeDb(db);
  res.json(ok(true));
});

app.patch('/api/drawings/:id/metrics', (req, res) => {
  const db = readDb();
  const drawing = db.drawings.find((d) => d.id === req.params.id);
  if (!drawing) {
    res.status(404).json(err('图纸不存在'));
    return;
  }
  const { field, newValue, reason, operatorId, operatorName } = req.body;
  if (!field || newValue === undefined || !reason || !operatorId || !operatorName) {
    res.status(400).json(err('缺少必填字段'));
    return;
  }
  if (reason.trim().length < 4) {
    res.status(400).json(err('变更原因至少需要4个字符'));
    return;
  }
  if (!(field in drawing.metrics)) {
    res.status(400).json(err('指标字段不存在'));
    return;
  }
  const oldValue = (drawing.metrics as any)[field];
  if (oldValue === newValue) {
    res.json(ok(null));
    return;
  }
  (drawing.metrics as any)[field] = newValue;
  const now = nowIso();
  drawing.updatedAt = now;

  const changeLog: ValueChangeLog = {
    id: uid('c'),
    drawingId: drawing.id,
    fieldName: field,
    fieldLabel: METRIC_FIELD_LABELS[field] || field,
    oldValue,
    newValue,
    reason,
    operatorId,
    operatorName,
    changedAt: now,
  };
  db.changeLogs.push(changeLog);

  writeDb(db);
  res.json(ok(changeLog));
});

app.patch('/api/drawings/:id/status', (req, res) => {
  const db = readDb();
  const drawing = db.drawings.find((d) => d.id === req.params.id);
  if (!drawing) {
    res.status(404).json(err('图纸不存在'));
    return;
  }
  const { status, operatorId, operatorName } = req.body;
  if (!status || !operatorId || !operatorName) {
    res.status(400).json(err('缺少必填字段'));
    return;
  }
  const validStatuses: DrawingStatus[] = ['normal', 'abnormal', 'reviewing', 'closed'];
  if (!validStatuses.includes(status as DrawingStatus)) {
    res.status(400).json(err('无效的状态值'));
    return;
  }
  if (status === 'reviewing' || status === 'closed') {
    const dNotes = db.notes.filter(
      (n) => n.drawingId === drawing.id && (n.tag === 'review' || n.tag === 'fix'),
    );
    if (dNotes.length < 1) {
      res
        .status(400)
        .json(err('状态流转前需先有复核或处理类备注'));
      return;
    }
  }
  const oldStatus = drawing.status;
  drawing.status = status as DrawingStatus;
  const now = nowIso();
  drawing.updatedAt = now;

  const changeLog: ValueChangeLog = {
    id: uid('c'),
    drawingId: drawing.id,
    fieldName: 'status',
    fieldLabel: '状态流转',
    oldValue: 0,
    newValue: 1,
    reason: '负责人确认状态变更',
    operatorId,
    operatorName,
    changedAt: now,
  };
  db.changeLogs.push(changeLog);

  writeDb(db);
  res.json(ok({ oldStatus, newStatus: status }));
});

app.patch('/api/materials/:mid/supplied', (req, res) => {
  const db = readDb();
  const material = db.materials.find((m) => m.id === req.params.mid);
  if (!material) {
    res.status(404).json(err('材料不存在'));
    return;
  }
  const { operatorName } = req.body;
  if (!operatorName) {
    res.status(400).json(err('缺少操作人'));
    return;
  }
  const now = nowIso();
  material.isMissing = false;
  material.suppliedAt = now;
  material.reviewHint = undefined;

  const changeLog: ValueChangeLog = {
    id: uid('c'),
    drawingId: material.drawingId,
    fieldName: 'materialSupplied',
    fieldLabel: '材料齐备',
    oldValue: 0,
    newValue: 1,
    reason: material.batchNo + material.materialName + '补录完成',
    operatorId: '',
    operatorName,
    changedAt: now,
  };
  db.changeLogs.push(changeLog);

  const drawing = db.drawings.find((d) => d.id === material.drawingId);
  if (drawing) {
    drawing.updatedAt = now;
  }

  writeDb(db);
  res.json(ok(material));
});

app.patch('/api/materials/:mid/missing', (req, res) => {
  const db = readDb();
  const material = db.materials.find((m) => m.id === req.params.mid);
  if (!material) {
    res.status(404).json(err('材料不存在'));
    return;
  }
  const { reviewHint, operatorName, operatorId } = req.body;
  if (!reviewHint || !operatorName || !operatorId) {
    res.status(400).json(err('缺少必填字段'));
    return;
  }
  const now = nowIso();
  material.isMissing = true;
  material.reviewHint = reviewHint;
  material.suppliedAt = undefined;

  const changeLog: ValueChangeLog = {
    id: uid('c'),
    drawingId: material.drawingId,
    fieldName: 'materialMissing',
    fieldLabel: '材料缺料',
    oldValue: 1,
    newValue: 0,
    reason: reviewHint.slice(0, 50),
    operatorId,
    operatorName,
    changedAt: now,
  };
  db.changeLogs.push(changeLog);

  const drawing = db.drawings.find((d) => d.id === material.drawingId);
  if (drawing) {
    drawing.updatedAt = now;
  }

  writeDb(db);
  res.json(ok(material));
});

app.post('/api/export-logs', (req, res) => {
  const db = readDb();
  const { type, drawingId, operatorName, fileName } = req.body;
  if (!type || !operatorName || !fileName) {
    res.status(400).json(err('缺少必填字段'));
    return;
  }
  const now = nowIso();
  const newLog: ExportLog = {
    id: uid('e'),
    type,
    drawingId,
    operatorName,
    exportedAt: now,
    fileName,
  };
  db.exportLogs.push(newLog);
  writeDb(db);
  res.json(ok(newLog));
});

app.get('/api/export/data', (req, res) => {
  const db = readDb();
  const scope = (req.query.scope as string) || 'all';
  let drawings = db.drawings;
  if (scope !== 'all') {
    drawings = drawings.filter((d) => d.id === scope);
  }
  const drawingIds = drawings.map((d) => d.id);
  const versions = db.versions.filter((v) => drawingIds.includes(v.drawingId));
  const notes = db.notes.filter((n) => drawingIds.includes(n.drawingId));
  const materials = db.materials.filter((m) => drawingIds.includes(m.drawingId));
  const changeLogs = db.changeLogs.filter((c) => drawingIds.includes(c.drawingId));

  const drawingsWithExtra = drawings.map((d) => {
    const dNotes = db.notes.filter((n) => n.drawingId === d.id);
    const dMaterials = db.materials.filter((m) => m.drawingId === d.id);
    const dChangeLogs = db.changeLogs.filter((c) => c.drawingId === d.id);
    const latestVersion =
      db.versions.find((v) => v.id === d.currentVersionId) || null;
    const latestNote =
      dNotes.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ||
      null;
    const abnormalCount =
      d.metrics.collisionPoints +
      d.metrics.unqualifiedItems +
      d.metrics.sunShadowRisk;
    const missingMaterialCount = dMaterials.filter((m) => m.isMissing).length;
    const changeCount = dChangeLogs.length;
    return {
      ...d,
      latestVersion,
      latestNote,
      abnormalCount,
      missingMaterialCount,
      changeCount,
    };
  });

  res.json(
    ok({
      drawings: drawingsWithExtra,
      versions,
      notes,
      materials,
      changeLogs,
      users: db.users,
      generatedAt: nowIso(),
    }),
  );
});

app.get('/api/summary', (req, res) => {
  const db = readDb();
  const total = db.drawings.length;
  let abnormal = 0;
  let reviewing = 0;
  let normal = 0;
  let closed = 0;
  let missingMaterialDrawings = 0;

  for (const d of db.drawings) {
    switch (d.status) {
      case 'abnormal':
        abnormal++;
        break;
      case 'reviewing':
        reviewing++;
        break;
      case 'normal':
        normal++;
        break;
      case 'closed':
        closed++;
        break;
    }
    const dMaterials = db.materials.filter((m) => m.drawingId === d.id);
    if (dMaterials.some((m) => m.isMissing)) {
      missingMaterialDrawings++;
    }
  }

  res.json(
    ok({
      total,
      abnormal,
      reviewing,
      normal,
      closed,
      missingMaterialDrawings,
    }),
  );
});

app.get('/api/users', (req, res) => {
  const db = readDb();
  res.json(ok(db.users));
});

app.listen(3001, () => {
  console.log('[server] Express server running on http://localhost:3001');
  const db = readDb();
  writeDb(db);
});
