import type { CollisionRecord } from '@/types';

const IMG = (p: string, size: 'square' | 'landscape_4_3' | 'portrait_4_3' = 'landscape_4_3') =>
  `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=${encodeURIComponent(p)}&image_size=${size}`;

const MAIN_VIEW_PROMPTS = [
  'BIM architectural curtain wall node collision detail, structural steel beam intersecting with aluminum panel frame, isometric engineering view, professional technical drawing style, subtle shadows',
  'Curtain wall embedded part deviation detail, steel anchoring bracket misaligned with concrete slab edge, CAD-style 3D visualization, technical annotation highlights, cool blue tone',
  'Weld conflict at curtain wall connection node, two steel members overlapping at joint, BIM model clash detection view, red highlighted interference zone, engineering render',
  'Glass curtain wall mullion collision with floor slab edge, structural cross-section view, detailed architectural joint, professional construction document style rendering',
  'Curtain wall support bracket collision with HVAC duct, 3D BIM coordination view, multiple building systems visible, clash detection markers, technical illustration',
  'Unitized curtain wall panel misalignment, adjacent panels offset vertically, installation quality view, close-up detail, architectural technical photography style',
  'Seismic joint detail curtain wall node, expansion gap insufficient size, structural movement analysis view, cross-section technical render, engineering documentation quality',
  'Fire rated curtain wall penetration, sealant gap inadequate around steel member, firestop detail view, BIM model with fire safety annotation, professional render',
  'Curtain wall pressure plate fastener spacing violation, too few bolts visible along mullion, quality audit detail view, technical close-up with dimension lines',
  'Double skin facade inner layer collision, ventilation cavity obstruction, BIM section view, layered construction visualization, engineering technical style',
  'Stone curtain wall anchor point overload condition, multiple brackets concentrated, structural analysis visualization, stress heat map overlay on 3D model',
  'Aluminum curtain wall extrusion die mismatch, profile joint gap exceeding tolerance, quality inspection detail view, industrial technical photography lighting',
];

const AUX_VIEW_PROMPTS = [
  'BIM model top plan view of curtain wall collision zone, floor plan perspective, column grid visible, engineering technical style',
  'Curtain wall node side elevation view, structural profile cross section, dimension annotation lines, CAD drafting style',
  '3D isometric exploded view of curtain wall connection node, components separated, callout labels, assembly drawing style',
  'Close-up detail of structural steel to curtain wall bracket connection, welding seam detail, technical documentation quality',
  'Horizontal section through curtain wall mullion, glass panel and aluminum frame visible, architectural drawing convention',
  'Axonometric view of floor slab edge with curtain wall anchor points, embed plates visible, structural BIM style',
];

function makeScreenshots(idx: number) {
  const main = MAIN_VIEW_PROMPTS[idx % MAIN_VIEW_PROMPTS.length];
  const aux1 = AUX_VIEW_PROMPTS[(idx * 2) % AUX_VIEW_PROMPTS.length];
  const aux2 = AUX_VIEW_PROMPTS[(idx * 2 + 1) % AUX_VIEW_PROMPTS.length];
  const aux3 = AUX_VIEW_PROMPTS[(idx * 3 + 1) % AUX_VIEW_PROMPTS.length];
  const baseCam = [
    { x: 12.5 + idx * 0.3, y: 8.2, z: 15.7 },
    { x: 0, y: 18.4, z: 10.1 },
    { x: 18.2, y: 2.1, z: 8.6 },
    { x: -10.5, y: 6.8, z: 4.3 },
  ];
  const baseTgt = [
    { x: 5.2, y: 3.1, z: 6.4 },
    { x: 5.2, y: 0, z: 6.4 },
    { x: 5.2, y: 3.1, z: 6.4 },
    { x: 5.2, y: 3.1, z: 6.4 },
  ];
  return [
    { id: `ss-${idx}-main`, url: IMG(main, 'landscape_4_3'), label: '主视图', cameraPosition: baseCam[0], targetPosition: baseTgt[0] },
    { id: `ss-${idx}-aux1`, url: IMG(aux1, 'square'), label: '俯视图', cameraPosition: baseCam[1], targetPosition: baseTgt[1] },
    { id: `ss-${idx}-aux2`, url: IMG(aux2, 'square'), label: '左视图', cameraPosition: baseCam[2], targetPosition: baseTgt[2] },
    { id: `ss-${idx}-aux3`, url: IMG(aux3, 'square'), label: '右视图', cameraPosition: baseCam[3], targetPosition: baseTgt[3] },
  ];
}

function makeClueChain(idx: number, type: string, conclusion: string) {
  const samples = [
    '从F12~F15层幕墙单元体批量抽取36个节点，检出率约11%',
    '针对北立面转角区域专项检查，共提取24个典型节点样本',
    '按每层10%抽样原则，从8个标准层中抽取40个检查点',
  ];
  const judges = [
    `初判${type}：构件最小净距仅12mm，低于规范30mm要求`,
    `初判${type}：预埋件中心偏差达48mm，超出允许值±25mm`,
    `初判${type}：双侧焊缝空间冲突，焊枪操作距离不足`,
  ];
  const reviews = [
    '复核人调取原模型坐标核对，确认BIM模型版本为V2.3发布版',
    '复核比对施工深化图JS-22-14节点，确认标注尺寸一致',
    '复核现场激光扫描点云数据，偏差值与模型吻合',
  ];
  return [
    {
      id: `clue-${idx}-1`, step: 'SAMPLE' as const,
      title: '样本抽取记录', description: samples[idx % samples.length],
      operator: '建模组-张工', timestamp: `2026-05-${10 + (idx % 15)}T09:12:00`,
    },
    {
      id: `clue-${idx}-2`, step: 'INITIAL_JUDGEMENT' as const,
      title: '自动碰撞检测', description: judges[idx % judges.length],
      operator: 'Navisworks自动', timestamp: `2026-05-${12 + (idx % 12)}T14:30:00`,
    },
    {
      id: `clue-${idx}-3`, step: 'REVIEW' as const,
      title: '工程复核意见', description: reviews[idx % reviews.length],
      operator: '结构组-老叶', timestamp: `2026-05-${14 + (idx % 10)}T11:08:00`,
    },
    {
      id: `clue-${idx}-4`, step: 'CONCLUSION' as const,
      title: '预审结论', description: conclusion,
      operator: '负责人-王总', timestamp: `2026-05-${16 + (idx % 8)}T16:45:00`,
    },
  ];
}

const PROJECTS = ['国贸中心T3塔楼', '滨江金融广场A座', '科创园总部大厦'];
const FLOORS = ['F08', 'F12', 'F15', 'F22'];
const TYPES = ['构件干涉', '预埋件偏差', '焊缝冲突', '净距不足'];
const PERSONS = ['老叶', '张工', '李工', '王工'];
const ELEMENTS_A = ['幕墙竖梃ML-12A', '预埋件EP-220', '钢牛腿SC-07', '转接件AJ-15'];
const ELEMENTS_B = ['结构边梁KL-8', '混凝土楼板SL-15', '机电风管KD-400', '消防主管XF-200'];
const STATUSES: Array<{ s: CollisionRecord['status']; c: string; sample?: boolean; offset?: boolean; offsetNote?: string; rejudge: number }> = [
  { s: 'PASSED', c: '构件间隙经调整满足30mm要求，放行', sample: true, rejudge: 0 },
  { s: 'PASSED', c: '预埋件偏差在调整件补偿范围内，放行', rejudge: 0 },
  { s: 'PENDING_EVIDENCE', c: '需补充现场焊缝超声波检测报告后再判定', rejudge: 0 },
  { s: 'PASSED', c: '经设计复核，局部加强后可放行', rejudge: 1 },
  { s: 'MANUAL_REJUDGED', c: '碰撞属模型导出误差，人工改判放行；坐标整体偏移+23mm', offset: true, offsetNote: '从Navisworks导出时坐标系原点未对齐结构±0.000，Z轴整体偏移+23.4mm，实际碰撞需减去该值再判', sample: true, rejudge: 3 },
  { s: 'PENDING_EVIDENCE', c: '待补充设计单位出具的节点变更单', rejudge: 1 },
  { s: 'REJECTED', c: '净距严重不足，必须重新拆分幕墙单元', rejudge: 2 },
  { s: 'PASSED', c: '角度微调后通过，已更新节点图', rejudge: 0 },
  { s: 'MANUAL_REJUDGED', c: '坐标系换算错误，人工改判后实际无碰撞；坐标偏移-17mm', offset: true, offsetNote: '土建模型采用城市坐标系而幕墙采用局部坐标系，X方向存在-17.1mm换算差，修正后节点合格', rejudge: 2 },
  { s: 'PENDING_EVIDENCE', c: '需提供厂家型材实际截面尺寸复核', rejudge: 0 },
  { s: 'REJECTED', c: '结构梁下翼缘与竖梃冲突，需修改竖梃分段', offset: true, offsetNote: '实测结构梁施工偏差达+31mm，与原模型不符，需按实际位置重新排布', rejudge: 3 },
  { s: 'PASSED', c: '与机电协调后风管上翻200mm，冲突解除', rejudge: 1 },
];

function makeHistory(idx: number, count: number, finalStatus: CollisionRecord['status']) {
  if (count === 0) return [];
  const flow: CollisionRecord['status'][] = ['PENDING_EVIDENCE', 'REJECTED', 'MANUAL_REJUDGED', 'PASSED'];
  const reasons = [
    '补充提交节点大样图后重新提交',
    '现场实测数据与模型不符，驳回重算',
    '经设计确认改判，依据设计变更单DS-2026-042',
    '各方协调会达成一致，调整方案可行',
  ];
  const records: CollisionRecord['history'] = [];
  let prev: CollisionRecord['status'] = 'PENDING_EVIDENCE';
  for (let i = 0; i < count; i++) {
    const next = (i === count - 1 ? finalStatus : flow[(i + 1) % flow.length]) as CollisionRecord['status'];
    records.push({
      id: `hist-${idx}-${i}`,
      collisionId: `CL2024-${String(idx + 1).padStart(3, '0')}`,
      previousStatus: prev,
      newStatus: next,
      reason: reasons[i % reasons.length],
      operator: PERSONS[(idx + i) % PERSONS.length],
      timestamp: `2026-05-${18 + i}T${10 + i}:0${i}:00`,
    });
    prev = next;
  }
  return records;
}

export function generateSeedData(): CollisionRecord[] {
  return STATUSES.map((cfg, idx) => {
    const id = `CL2024-${String(idx + 1).padStart(3, '0')}`;
    const project = PROJECTS[idx % PROJECTS.length];
    const floor = FLOORS[idx % FLOORS.length];
    const nodeCode = `N-${floor.slice(1)}-${String(idx * 7 + 3).padStart(2, '0')}`;
    const ctype = TYPES[idx % TYPES.length];
    const elA = ELEMENTS_A[idx % ELEMENTS_A.length];
    const elB = ELEMENTS_B[idx % ELEMENTS_B.length];
    const person = PERSONS[idx % PERSONS.length];
    return {
      id,
      projectName: project,
      floor,
      nodeCode,
      collisionType: ctype,
      elementA: elA,
      elementB: elB,
      status: cfg.s,
      initialConclusion: cfg.c,
      screenshots: makeScreenshots(idx),
      clueChain: makeClueChain(idx, ctype, cfg.c),
      history: makeHistory(idx, cfg.rejudge, cfg.s),
      isCoordinateOffset: !!cfg.offset,
      coordinateOffsetNote: cfg.offsetNote,
      rejudgeCount: cfg.rejudge,
      responsiblePerson: person,
      isSample: !!cfg.sample,
      createdAt: `2026-05-${8 + (idx % 15)}T09:00:00`,
      updatedAt: `2026-06-${1 + (idx % 9)}T${10 + (idx % 7)}:${15 + idx}:00`,
    };
  });
}
