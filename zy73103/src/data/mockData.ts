import type {
  AnomalyRecord,
  BimNote,
  DrainageScheme,
  SchemeId,
  TimelineEvent,
} from '../types';
import { buildCanonicalTexts, formatDate, nowIso, schemeStatusLabel, uid, validateLayerName } from '../utils/helpers';

export const INITIAL_SCHEMES: DrainageScheme[] = [
  {
    id: 'A',
    name: '檐沟外排水方案',
    efficiency: 82,
    cost: 128,
    duration: 18,
    risk: 3,
    status: 'reviewing',
    recommLevel: '推荐',
    responsible: '结构工程师·老叶 / 施工方·一建三队',
    constructionSpec:
      '屋面坡度 2%，UPVC 檐沟宽 250mm，雨水斗 DN100@12m 布置，立管沿外墙明装',
    sceneAnnotation:
      '北坡 A1–A4 区坡向檐沟，排水点 4 处集中至东西两侧立管，结构荷载较小但抗冻性需复核',
    sideNote: '',
    roofZones: [
      { id: 'A-A1', label: '北坡-1区', position: [-4.5, 0, -3], size: [5, 4], slope: 2, hasAnomaly: false },
      { id: 'A-A2', label: '北坡-2区', position: [0.5, 0, -3], size: [5, 4], slope: 2, hasAnomaly: true },
      { id: 'A-A3', label: '南坡-1区', position: [-4.5, 0, 3], size: [5, 4], slope: 2, hasAnomaly: false },
      { id: 'A-A4', label: '南坡-2区', position: [0.5, 0, 3], size: [5, 4], slope: 2, hasAnomaly: false },
    ],
  },
  {
    id: 'B',
    name: '天沟内排水方案',
    efficiency: 91,
    cost: 176,
    duration: 25,
    risk: 5,
    status: 'pending_material',
    recommLevel: '备选',
    responsible: '结构工程师·老叶 / 机电·王工 / 施工方·一建三队',
    constructionSpec:
      '屋面坡度 1.5%，不锈钢天沟 300×200mm，虹吸雨水斗 DN110@10m，立管穿结构层并设防水套管',
    sceneAnnotation:
      '中间天沟 B1–B2 汇水后转入核心筒内立管，排水效率高但需与机电协调穿楼板位置，B2 区图层命名待核查',
    sideNote: '',
    roofZones: [
      { id: 'B-B1', label: '天沟-西区', position: [-3, 0, -0.5], size: [5, 3], slope: 1.5, hasAnomaly: false },
      { id: 'B-B2', label: '天沟-中区', position: [0, 0, -0.5], size: [4, 3], slope: 1.5, hasAnomaly: true },
      { id: 'B-B3', label: '天沟-东区', position: [3.5, 0, -0.5], size: [4, 3], slope: 1.5, hasAnomaly: false },
      { id: 'B-B4', label: '南侧补坡', position: [0, 0, 3.5], size: [10, 3], slope: 1.5, hasAnomaly: false },
    ],
  },
  {
    id: 'C',
    name: '混合排水方案（外+内）',
    efficiency: 87,
    cost: 205,
    duration: 30,
    risk: 6,
    status: 'draft',
    recommLevel: '待完善',
    responsible: '结构工程师·老叶 / 项目经理·张总 / 施工方·一建三队',
    constructionSpec:
      '北区檐沟外排 + 南区天沟内排，汇水分区由 C1–C4 划清，界面处设变形缝防水加强层',
    sceneAnnotation:
      '两套系统界面复杂，C3 区图层命名混乱且虹吸附件送审晚到，先按待补齐归档，重跑后再定推荐等级',
    sideNote: '',
    roofZones: [
      { id: 'C-C1', label: '北区-外排', position: [-3.5, 0, -3.5], size: [5, 4], slope: 2, hasAnomaly: false },
      { id: 'C-C2', label: '中区-过渡带', position: [0.5, 0, -1.5], size: [4, 4], slope: 1.8, hasAnomaly: false },
      { id: 'C-C3', label: '南区-内排1', position: [3.5, 0, 1.5], size: [4, 4], slope: 1.5, hasAnomaly: true },
      { id: 'C-C4', label: '南区-内排2', position: [-1.5, 0, 3.5], size: [5, 4], slope: 1.5, hasAnomaly: true },
    ],
  },
];

export const SAMPLE_NOTES: BimNote[] = [
  {
    id: 'note-A-001',
    schemeId: 'A',
    layerName: 'ROF-001-A',
    content: '北坡A1檐沟找坡复核：最薄处30mm细石砼，符合方案A施工口径。',
    author: '老叶（结构）',
    createdAt: '2026-06-08T09:12:00.000Z',
    materialStatus: 'complete',
    attachmentId: 'att-001',
    attachmentName: '檐沟截面详图_v2.pdf',
    isLayerValid: true,
    affectedZoneId: 'A-A1',
  },
  {
    id: 'note-A-002',
    schemeId: 'A',
    layerName: 'ROF_002A_layer2',
    content: '北坡A2雨水斗定位与结构预留洞偏差25mm，需与机电王工复核穿楼板位置。',
    author: '老叶（结构）',
    createdAt: '2026-06-08T10:48:00.000Z',
    materialStatus: 'complete',
    isLayerValid: false,
    layerIssue: '命名规则应为 ROF-XXX-XX（短横线分隔），实际使用了下划线且后缀不规范，图层合并时可能混入结果',
    affectedZoneId: 'A-A2',
  },
  {
    id: 'note-A-003',
    schemeId: 'A',
    layerName: 'ROF-003-A',
    content: '南坡A3排水立管沿外墙明装，施工方反馈外立面需统一隐蔽，建议调整为凹槽暗装。',
    author: '一建三队·李工',
    createdAt: '2026-06-09T14:20:00.000Z',
    materialStatus: 'pending',
    attachmentId: 'att-003',
    attachmentName: '外立面隐蔽方案对比.docx',
    isLayerValid: true,
    estimatedArrival: '2026-06-12',
    affectedZoneId: 'A-A3',
  },
  {
    id: 'note-B-001',
    schemeId: 'B',
    layerName: 'ROF-101-B',
    content: 'B1区天沟不锈钢厚度由2.0mm改为2.5mm，抗冻胀考虑，造价增加约3.2万。',
    author: '老叶（结构）',
    createdAt: '2026-06-07T11:05:00.000Z',
    materialStatus: 'complete',
    isLayerValid: true,
    affectedZoneId: 'B-B1',
  },
  {
    id: 'note-B-002',
    schemeId: 'B',
    layerName: '天沟B区图层复制自旧项目',
    content: 'B2区虹吸雨水斗安装标高与暖通风管冲突，图层直接从2024项目复制，命名未同步。',
    author: '实习生·小周',
    createdAt: '2026-06-09T08:35:00.000Z',
    materialStatus: 'late',
    attachmentName: '虹吸斗送审合格证.pdf',
    isLayerValid: false,
    layerIssue: '图层名含中文且无编号，完全不符合 ROF-XXX-XX 规范，导致比选时该记录容易揉进正常结果',
    estimatedArrival: '2026-06-15',
    affectedZoneId: 'B-B2',
  },
  {
    id: 'note-C-001',
    schemeId: 'C',
    layerName: 'ROF-201-C',
    content: 'C1/C2界面处变形缝加强层做法：双面自粘+70mm厚聚苯板过渡，已与防水厂家确认。',
    author: '老叶（结构）',
    createdAt: '2026-06-06T15:40:00.000Z',
    materialStatus: 'complete',
    isLayerValid: true,
    affectedZoneId: 'C-C1',
  },
  {
    id: 'note-C-002',
    schemeId: 'C',
    layerName: 'roof-c3-test-v7_final2',
    content: 'C3区内排虹吸斗附件送审材料至今未到，先按延迟归档处理，不卡死比选流程。',
    author: '张总（项目经理）',
    createdAt: '2026-06-10T07:22:00.000Z',
    materialStatus: 'late',
    attachmentName: '虹吸斗-合格证-检测报告全套.zip',
    isLayerValid: false,
    layerIssue: '全小写+下划线，未加ROF前缀；被误识别为临时测试图层，多次被正常比选过滤遗漏，同时也被图层合并工具错误合并',
    estimatedArrival: '2026-06-18',
    affectedZoneId: 'C-C3',
  },
  {
    id: 'note-C-003',
    schemeId: 'C',
    layerName: 'ROF-204-C',
    content: 'C4区内排立管穿梁洞口直径350mm，结构复核需加强箍筋φ14@100，已同步给梁图。',
    author: '老叶（结构）',
    createdAt: '2026-06-10T13:58:00.000Z',
    materialStatus: 'complete',
    isLayerValid: true,
    affectedZoneId: 'C-C4',
  },
];

export function buildInitialTimeline(schemes: DrainageScheme[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  schemes.forEach((s, idx) => {
    const t = new Date(`2026-06-0${idx + 5}T09:${String(idx * 7 + 10).padStart(2, '0')}:00.000Z`);
    events.push({
      id: uid('ev'),
      schemeId: s.id,
      timestamp: t.toISOString(),
      eventType: 'scheme_created',
      title: `方案${s.id}创建：${s.name}`,
      description: buildCanonicalTexts({ scheme: s, eventKind: 'scene' }),
      toState: schemeStatusLabel(s.status),
      actor: '系统初始化',
      tags: [s.id],
    });
  });
  return events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export function detectAnomalies(notes: BimNote[]): AnomalyRecord[] {
  const result: AnomalyRecord[] = [];
  for (const note of notes) {
    if (!validateLayerName(note.layerName)) {
      result.push({
        id: uid('anom'),
        noteId: note.id,
        schemeId: note.schemeId,
        type: 'layer_name',
        title: `图层命名异常：${note.layerName}`,
        detail:
          note.layerIssue ??
          '图层名不符合约定的 ROF-XXX-XX 规范，容易被合并脚本误并入正常结果',
        cause:
          'BIM 模型来自不同设计师/旧项目复用，图层命名规则执行不到位，缺少提交前自动校验',
        responsible: note.author,
        status: note.schemeId === 'B' ? 'investigating' : 'open',
        affectedZoneId: note.affectedZoneId,
        firstDetected: note.createdAt,
      });
    }
    if (note.materialStatus === 'late') {
      result.push({
        id: uid('anom'),
        noteId: note.id,
        schemeId: note.schemeId,
        type: 'attachment_late',
        title: `附件晚到：${note.attachmentName ?? '送审材料'}`,
        detail: `备注 [${note.layerName}] 所关联的送审附件未按时到齐，预计 ${note.estimatedArrival ?? '待定'} 抵达。已按「延迟归档」进入时间线，不阻塞比选流程。`,
        cause: '材料供应商报审滞后 / 合格证检测报告原件扫描排队',
        responsible: '项目经理·张总（催办）/ 材料部',
        status: 'open',
        affectedZoneId: note.affectedZoneId,
        firstDetected: note.createdAt,
      });
    }
  }
  return result;
}

export function buildNoteImportTimeline(
  scheme: DrainageScheme,
  note: BimNote,
  anomalies: AnomalyRecord[],
): TimelineEvent[] {
  const now = nowIso();
  const out: TimelineEvent[] = [];
  out.push({
    id: uid('ev'),
    schemeId: note.schemeId,
    noteId: note.id,
    timestamp: note.createdAt,
    eventType: 'note_imported',
    title: `方案${note.schemeId} 录入 BIM 备注 [${note.layerName}]`,
    description: buildCanonicalTexts({ scheme, note, eventKind: 'timeline_note' }),
    actor: note.author,
    tags: [note.schemeId, 'note'],
  });
  if (note.materialStatus === 'late') {
    const anom = anomalies.find((a) => a.noteId === note.id && a.type === 'attachment_late');
    out.push({
      id: uid('ev'),
      schemeId: note.schemeId,
      noteId: note.id,
      anomalyId: anom?.id,
      timestamp: note.createdAt,
      eventType: 'material_late',
      title: `方案${note.schemeId} 附件晚到 → 已延迟归档`,
      description: `备注 [${note.layerName}] 送审附件「${note.attachmentName ?? '材料附件'}」未到齐。已以待补齐/延迟归档进入时间线，未阻塞比选流程。预计到齐 ${note.estimatedArrival ?? '待定'}。`,
      actor: '系统（自动判定）',
      fromState: '材料收集中',
      toState: '晚到/待补齐（延迟归档）',
      tags: [note.schemeId, 'late', 'anomaly'],
    });
  }
  if (!note.isLayerValid) {
    const anom = anomalies.find((a) => a.noteId === note.id && a.type === 'layer_name');
    out.push({
      id: uid('ev'),
      schemeId: note.schemeId,
      noteId: note.id,
      anomalyId: anom?.id,
      timestamp: note.createdAt,
      eventType: 'anomaly_detected',
      title: `方案${note.schemeId} 图层命名异常 → 已单独拎出`,
      description: `备注 [${note.layerName}] 命名不规范：${note.layerIssue ?? ''}。已从正常比选结果中拆分，进入异常记录区单独追踪，避免揉入汇总。`,
      actor: '校验引擎',
      fromState: '待导入',
      toState: '异常拎出待处理',
      tags: [note.schemeId, 'anomaly', 'layer'],
    });
  }
  return out;
}

export { formatDate };
