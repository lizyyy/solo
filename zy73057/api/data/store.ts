import type {
  ScheduleBatch,
  ScheduleItem,
  MaintenancePhoto,
  OverrideRecord,
  ReplaceAction,
  Snapshot,
  FilterSignaturePayload,
} from '../../shared/types.js';

export interface DataStore {
  batches: ScheduleBatch[];
  items: ScheduleItem[];
  photos: MaintenancePhoto[];
  overrides: OverrideRecord[];
  replaceActions: ReplaceAction[];
  snapshots: Snapshot[];
  signatures: FilterSignaturePayload[];
}

const elevators = ['E-A-01', 'E-A-02', 'E-B-05', 'E-B-07', 'E-C-11', 'E-C-12', 'E-D-03', 'E-D-08'];

function partInfo(code: string) {
  const map: Record<string, { name: string; price: number }> = {
    'T-YK-003':   { name: '曳引轮油封（原配）',           price: 230 },
    'T-YK-003-B': { name: '曳引轮油封（加厚兼容款）',     price: 325 },
    'T-MJ-012':   { name: '门机皮带',                     price: 88  },
    'T-MJ-012L':  { name: '门机皮带（长距款）',           price: 102 },
    'T-PZ-207':   { name: '平层感应器',                   price: 410 },
    'T-PZ-207N':  { name: '平层感应器（升级版）',         price: 485 },
    'T-ZD-088':   { name: '制动闸瓦',                     price: 180 },
    'T-DL-041':   { name: '底坑缓冲垫',                   price: 65  },
    'T-AM-055':   { name: '安全钳楔块',                   price: 360 },
    'T-KG-093':   { name: '开关门限位开关',               price: 55  },
  };
  return map[code] ?? { name: code, price: 100 };
}

function buildOverrideImpactChain(
  override: OverrideRecord,
  item: ScheduleItem,
): OverrideRecord['impactChain'] {
  const before = override.before;
  const after = override.after;
  const partBefore = partInfo(before.partNo);
  const partAfter = partInfo(after.partNo);
  const deltaItem = (after.qty * partAfter.price) - (before.qty * partBefore.price);
  const deltaAvg = deltaItem;

  const n0 = {
    id: 'node-override-' + override.id,
    level: 'override' as const,
    label: `人工改判 · 复核人 ${override.createdBy}`,
    detail: `原因：${override.reason}`,
    childrenIds: ['node-item-' + item.id],
  };
  const n1 = {
    id: 'node-item-' + item.id,
    level: 'item' as const,
    label: `影响排程行 ${item.elevatorNo} · ${item.faultCode}`,
    detail: `备件号：${before.partNo} × ${before.qty} → ${after.partNo} × ${after.qty}`,
    deltaValue: deltaItem,
    childrenIds: ['node-part-' + after.partNo],
  };
  const n2 = {
    id: 'node-part-' + after.partNo,
    level: 'part' as const,
    label: `备件型号替换影响`,
    detail: `单价 ￥${partBefore.price} → ￥${partAfter.price}，数量 ${before.qty} → ${after.qty}，行内差额 ￥${deltaItem}`,
    deltaValue: deltaItem,
    childrenIds: ['node-monthly-summary'],
  };
  const n3 = {
    id: 'node-monthly-summary',
    level: 'monthly_summary' as const,
    label: `月度汇总影响 · 平均值暴露`,
    detail: `改判前平均单梯备件 ￥420，改判后拉至 ￥515，单条改判拉动差额 ￥${deltaAvg}，原平均值已掩盖此异常。`,
    deltaValue: deltaAvg,
    childrenIds: [] as string[],
  };
  return [n0, n1, n2, n3];
}

export const store: DataStore = {
  batches: [],
  items: [],
  photos: [],
  overrides: [],
  replaceActions: [],
  snapshots: [],
  signatures: [],
};

// ===== 批次 B-2026-05-W4 =====  正常参考批次，无改判
const batch0: ScheduleBatch = {
  batchId: 'B-2026-05-W4',
  createdAt: '2026-05-25 09:02',
  createdBy: '小林',
  status: 'exported',
  version: 1,
  elevatorCount: 4,
  itemCount: 5,
  overrideCount: 0,
};

const itemsBatch0: ScheduleItem[] = [
  { id: 'i-5W4-01', batchId: batch0.batchId, version: 1, elevatorNo: elevators[0], faultCode: 'F101', faultDescription: '开关门异响',
    recommendedPartNo: 'T-KG-093', recommendedPartName: '开关门限位开关', recommendedQty: 1,
    finalPartNo: 'T-KG-093', finalPartName: '开关门限位开关', finalQty: 1,
    isOverridden: false, photoIds: ['p-5W4-01a'],
    monthlyImpactBefore: 55, monthlyImpactAfter: 55 },
  { id: 'i-5W4-02', batchId: batch0.batchId, version: 1, elevatorNo: elevators[1], faultCode: 'F213', faultDescription: '底坑缓冲垫老化',
    recommendedPartNo: 'T-DL-041', recommendedPartName: '底坑缓冲垫', recommendedQty: 2,
    finalPartNo: 'T-DL-041', finalPartName: '底坑缓冲垫', finalQty: 2,
    isOverridden: false, photoIds: ['p-5W4-02a'],
    monthlyImpactBefore: 130, monthlyImpactAfter: 130 },
  { id: 'i-5W4-03', batchId: batch0.batchId, version: 1, elevatorNo: elevators[2], faultCode: 'F307', faultDescription: '制动闸瓦磨损',
    recommendedPartNo: 'T-ZD-088', recommendedPartName: '制动闸瓦', recommendedQty: 2,
    finalPartNo: 'T-ZD-088', finalPartName: '制动闸瓦', finalQty: 2,
    isOverridden: false, photoIds: ['p-5W4-03a'],
    monthlyImpactBefore: 360, monthlyImpactAfter: 360 },
  { id: 'i-5W4-04', batchId: batch0.batchId, version: 1, elevatorNo: elevators[3], faultCode: 'F418', faultDescription: '门机皮带开裂',
    recommendedPartNo: 'T-MJ-012', recommendedPartName: '门机皮带', recommendedQty: 1,
    finalPartNo: 'T-MJ-012', finalPartName: '门机皮带', finalQty: 1,
    isOverridden: false, photoIds: ['p-5W4-04a'],
    monthlyImpactBefore: 88, monthlyImpactAfter: 88 },
  { id: 'i-5W4-05', batchId: batch0.batchId, version: 1, elevatorNo: elevators[4], faultCode: 'F520', faultDescription: '平层感应器漂移',
    recommendedPartNo: 'T-PZ-207', recommendedPartName: '平层感应器', recommendedQty: 1,
    finalPartNo: 'T-PZ-207', finalPartName: '平层感应器', finalQty: 1,
    isOverridden: false, photoIds: ['p-5W4-05a'],
    monthlyImpactBefore: 410, monthlyImpactAfter: 410 },
];

// ===== 批次 B-2026-06-W1 =====  补录重跑样例，含 parent + 断档
const batch1v1: ScheduleBatch = {
  batchId: 'B-2026-06-W1',
  createdAt: '2026-06-02 08:30',
  createdBy: '小林',
  status: 'rerun',
  version: 2,
  parentBatchId: 'B-2026-06-W1-V1',
  elevatorCount: 3,
  itemCount: 4,
  overrideCount: 0,
  riskNote: '本批次为重跑版本，历史 V1 存在照片缺失，已补录。',
};
const batch1v0: ScheduleBatch = {
  batchId: 'B-2026-06-W1-V1',
  createdAt: '2026-06-01 17:05',
  createdBy: '小林',
  status: 'draft',
  version: 1,
  elevatorCount: 3,
  itemCount: 3,
  overrideCount: 0,
  riskNote: '初版：E-C-12 缺维修照片被标记断档。',
};

const itemsBatch1v1: ScheduleItem[] = [
  { id: 'i-6W1-01', batchId: batch1v1.batchId, version: 2, elevatorNo: elevators[4], faultCode: 'F213', faultDescription: '底坑缓冲垫老化',
    recommendedPartNo: 'T-DL-041', recommendedPartName: '底坑缓冲垫', recommendedQty: 2,
    finalPartNo: 'T-DL-041', finalPartName: '底坑缓冲垫', finalQty: 2,
    isOverridden: false, photoIds: ['p-6W1-01a'],
    monthlyImpactBefore: 130, monthlyImpactAfter: 130 },
  { id: 'i-6W1-02', batchId: batch1v1.batchId, version: 2, elevatorNo: elevators[5], faultCode: 'F307', faultDescription: '制动闸瓦磨损（补录照片后追加）',
    recommendedPartNo: 'T-ZD-088', recommendedPartName: '制动闸瓦', recommendedQty: 4,
    finalPartNo: 'T-ZD-088', finalPartName: '制动闸瓦', finalQty: 4,
    isOverridden: false, photoIds: ['p-6W1-02a', 'p-6W1-02b'],
    lateNote: '2026-06-02 补录照片 E-C-12 制动闸瓦，V1 漏掉。',
    monthlyImpactBefore: 720, monthlyImpactAfter: 720 },
  { id: 'i-6W1-03', batchId: batch1v1.batchId, version: 2, elevatorNo: elevators[6], faultCode: 'F101', faultDescription: '开关门异响',
    recommendedPartNo: 'T-KG-093', recommendedPartName: '开关门限位开关', recommendedQty: 2,
    finalPartNo: 'T-KG-093', finalPartName: '开关门限位开关', finalQty: 2,
    isOverridden: false, photoIds: ['p-6W1-03a'],
    monthlyImpactBefore: 110, monthlyImpactAfter: 110 },
  { id: 'i-6W1-04', batchId: batch1v1.batchId, version: 2, elevatorNo: elevators[7], faultCode: 'F520', faultDescription: '平层感应器漂移',
    recommendedPartNo: 'T-PZ-207', recommendedPartName: '平层感应器', recommendedQty: 1,
    finalPartNo: 'T-PZ-207', finalPartName: '平层感应器', finalQty: 1,
    isOverridden: false, photoIds: ['p-6W1-04a'],
    monthlyImpactBefore: 410, monthlyImpactAfter: 410 },
];
const itemsBatch1v0: ScheduleItem[] = itemsBatch1v1
  .filter((it) => it.id !== 'i-6W1-02')
  .map((it) => ({ ...it, batchId: batch1v0.batchId, version: 1 }));

// ===== 批次 B-2026-06-W2 =====  重点样例：故意的人工改判 + 坏材料场景
const batch2: ScheduleBatch = {
  batchId: 'B-2026-06-W2',
  createdAt: '2026-06-08 10:15',
  createdBy: '小林',
  status: 'overridden',
  version: 1,
  elevatorCount: 5,
  itemCount: 6,
  overrideCount: 1,
  riskNote: '存在人工改判，月度平均值已掩盖异常，需复核人跟进。',
};

const overrideId = 'ov-6W2-001';
const overrideItemId = 'i-6W2-03';

const itemsBatch2: ScheduleItem[] = [
  { id: 'i-6W2-01', batchId: batch2.batchId, version: 1, elevatorNo: elevators[0], faultCode: 'F101', faultDescription: '开关门异响',
    recommendedPartNo: 'T-KG-093', recommendedPartName: '开关门限位开关', recommendedQty: 2,
    finalPartNo: 'T-KG-093', finalPartName: '开关门限位开关', finalQty: 2,
    isOverridden: false, photoIds: ['p-6W2-01a'],
    monthlyImpactBefore: 110, monthlyImpactAfter: 110 },
  { id: 'i-6W2-02', batchId: batch2.batchId, version: 1, elevatorNo: elevators[1], faultCode: 'F418', faultDescription: '门机皮带开裂',
    recommendedPartNo: 'T-MJ-012', recommendedPartName: '门机皮带', recommendedQty: 1,
    finalPartNo: 'T-MJ-012L', finalPartName: '门机皮带（长距款）', finalQty: 1,
    isOverridden: false, photoIds: ['p-6W2-02a'],
    monthlyImpactBefore: 88, monthlyImpactAfter: 102 },
  // 这条是重点人工改判样例
  { id: overrideItemId, batchId: batch2.batchId, version: 1, elevatorNo: elevators[2], faultCode: 'F631', faultDescription: '曳引轮漏油',
    recommendedPartNo: 'T-YK-003', recommendedPartName: '曳引轮油封（原配）', recommendedQty: 1,
    finalPartNo: 'T-YK-003-B', finalPartName: '曳引轮油封（加厚兼容款）', finalQty: 2,
    isOverridden: true, overrideId,
    photoIds: ['p-6W2-03a', 'p-6W2-03b'],
    lateNote: '现场油封卡槽磨损严重，原配规格无法压合，需换 B 款加厚（复核人改判后补说明）。',
    monthlyImpactBefore: 230, monthlyImpactAfter: 650 },
  { id: 'i-6W2-04', batchId: batch2.batchId, version: 1, elevatorNo: elevators[3], faultCode: 'F520', faultDescription: '平层感应器漂移',
    recommendedPartNo: 'T-PZ-207', recommendedPartName: '平层感应器', recommendedQty: 2,
    finalPartNo: 'T-PZ-207N', finalPartName: '平层感应器（升级版）', finalQty: 2,
    isOverridden: false, photoIds: ['p-6W2-04a'],
    monthlyImpactBefore: 820, monthlyImpactAfter: 970 },
  { id: 'i-6W2-05', batchId: batch2.batchId, version: 1, elevatorNo: elevators[6], faultCode: 'F701', faultDescription: '安全钳误触发',
    recommendedPartNo: 'T-AM-055', recommendedPartName: '安全钳楔块', recommendedQty: 1,
    finalPartNo: 'T-AM-055', finalPartName: '安全钳楔块', finalQty: 1,
    isOverridden: false, photoIds: ['p-6W2-05a'],
    monthlyImpactBefore: 360, monthlyImpactAfter: 360 },
  { id: 'i-6W2-06', batchId: batch2.batchId, version: 1, elevatorNo: elevators[7], faultCode: 'F213', faultDescription: '底坑缓冲垫老化',
    recommendedPartNo: 'T-DL-041', recommendedPartName: '底坑缓冲垫', recommendedQty: 3,
    finalPartNo: 'T-DL-041', finalPartName: '底坑缓冲垫', finalQty: 3,
    isOverridden: false, photoIds: ['p-6W2-06a'],
    monthlyImpactBefore: 195, monthlyImpactAfter: 195 },
];

const overrideW2: OverrideRecord = {
  id: overrideId,
  itemId: overrideItemId,
  batchId: batch2.batchId,
  createdAt: '2026-06-08 14:45',
  createdBy: '复核人-周师傅',
  reason: '维修照片显示曳引轮轴油封卡槽磨损深度超 0.8mm，原配 T-YK-003 压合后仍渗漏；仓库常备加厚兼容款 T-YK-003-B 可覆盖磨损槽口，现场建议双封，故数量从 1 改为 2。',
  impactExplanation: '单条行金额 ￥230 → ￥650，拉动该批次平均单梯备件金额从 ￥420 上升至 ￥515。若不标注，月底汇总时该异常将被平均值掩盖。',
  before: { partNo: 'T-YK-003',   partName: '曳引轮油封（原配）',       qty: 1 },
  after:  { partNo: 'T-YK-003-B', partName: '曳引轮油封（加厚兼容款）', qty: 2 },
  impactChain: [],
};
overrideW2.impactChain = buildOverrideImpactChain(overrideW2, itemsBatch2[2]);

const actionsBatch2: ReplaceAction[] = [
  {
    id: 'act-6W2-001',
    overrideId,
    batchId: batch2.batchId,
    oldPartNo: 'T-YK-003',   oldPartName: '曳引轮油封（原配）',
    newPartNo: 'T-YK-003-B', newPartName: '曳引轮油封（加厚兼容款）',
    qty: 2,
    targetWarehouse: '华东中心仓 A-03 架',
    assignee: '备件管理员-老陈',
    dueDate: '2026-06-12',
    status: 'blocked',
    blockingNote:
      '坏材料：仓库反馈新批次 T-YK-003-B 橡胶硬度检测报告不达标（实测 68°±2°，要求 72°±2°），已整批退回供应商。\n排查路径见 README 第 2 条：①动作清单点状态 → ②blockingNote 点链接 → ③联系供应商换货/启用备用批次 T-YK-003-B-R2。',
  },
  {
    id: 'act-6W2-002',
    overrideId: '',
    batchId: batch2.batchId,
    oldPartNo: 'T-PZ-207',   oldPartName: '平层感应器',
    newPartNo: 'T-PZ-207N',  newPartName: '平层感应器（升级版）',
    qty: 2,
    targetWarehouse: '华东中心仓 B-11 架',
    assignee: '备件管理员-老陈',
    dueDate: '2026-06-11',
    status: 'done',
  },
];

// ===== 维修照片：用在线占位图 =====
function photo(id: string, itemId: string, batchId: string, uploadedBy: string, supplementaryNote?: string, isSupplementary = false): MaintenancePhoto {
  return {
    id,
    itemId,
    batchId,
    url: `https://placehold.co/400x300/1F2A37/E8A33D?text=${encodeURIComponent(id)}`,
    uploadedAt: '2026-06-08 11:00',
    uploadedBy,
    supplementaryNote,
    isSupplementary,
  };
}

const photosSeed: MaintenancePhoto[] = [
  ...itemsBatch0.map((it) => photo(it.photoIds[0], it.id, it.batchId, '小林')),
  photo('p-6W1-01a', 'i-6W1-01', batch1v1.batchId, '小林'),
  photo('p-6W1-02a', 'i-6W1-02', batch1v1.batchId, '小林'),
  photo('p-6W1-02b', 'i-6W1-02', batch1v1.batchId, '小林', '2026-06-02 补录：E-C-12 制动闸瓦磨损特写', true),
  photo('p-6W1-03a', 'i-6W1-03', batch1v1.batchId, '小林'),
  photo('p-6W1-04a', 'i-6W1-04', batch1v1.batchId, '小林'),
  photo('p-6W2-01a', 'i-6W2-01', batch2.batchId, '小林'),
  photo('p-6W2-02a', 'i-6W2-02', batch2.batchId, '小林'),
  photo('p-6W2-03a', 'i-6W2-03', batch2.batchId, '小林', '曳引轮轴油封全景'),
  photo('p-6W2-03b', 'i-6W2-03', batch2.batchId, '小林', '卡槽磨损特写（复核人改判依据）', true),
  photo('p-6W2-04a', 'i-6W2-04', batch2.batchId, '小林'),
  photo('p-6W2-05a', 'i-6W2-05', batch2.batchId, '小林'),
  photo('p-6W2-06a', 'i-6W2-06', batch2.batchId, '小林'),
];

// ===== 快照 =====
const snapBatch2: Snapshot = {
  id: 'snap-B-2026-06-W2-V1',
  batchId: batch2.batchId,
  version: 1,
  createdAt: '2026-06-08 10:15',
  trigger: 'initial',
  itemSnapshot: itemsBatch2.map((it) => ({ ...it })),
  continuityCheck: { hasGap: false, missingItemIds: [] },
};
const snapBatch1v0: Snapshot = {
  id: 'snap-B-2026-06-W1-V1',
  batchId: batch1v0.batchId,
  version: 1,
  createdAt: '2026-06-01 17:05',
  trigger: 'initial',
  itemSnapshot: itemsBatch1v0.map((it) => ({ ...it })),
  continuityCheck: { hasGap: true, gapDetails: 'E-C-12 电梯缺维修照片未生成闸瓦排程行', missingItemIds: ['i-6W1-02'] },
};
const snapBatch1v1: Snapshot = {
  id: 'snap-B-2026-06-W1-V2',
  batchId: batch1v1.batchId,
  version: 2,
  createdAt: '2026-06-02 08:30',
  trigger: 'rerun',
  itemSnapshot: itemsBatch1v1.map((it) => ({ ...it })),
  continuityCheck: { hasGap: false, gapDetails: 'V1 断档已通过补录修复，新增 i-6W1-02（制动闸瓦）', missingItemIds: [] },
};

// ===== 载入 =====
store.batches = [batch2, batch1v1, batch1v0, batch0];
store.items = [...itemsBatch2, ...itemsBatch1v1, ...itemsBatch1v0, ...itemsBatch0];
store.photos = photosSeed;
store.overrides = [overrideW2];
store.replaceActions = actionsBatch2;
store.snapshots = [snapBatch2, snapBatch1v1, snapBatch1v0];
store.signatures = [];
