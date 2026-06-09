import { store } from '../data/store.js';
import type {
  OverrideRecord,
  ScheduleItem,
  ReplaceAction,
  ImpactNode,
} from '../../shared/types.js';

const PART_PRICES: Record<string, number> = {
  'T-YK-003': 230,
  'T-YK-003-B': 325,
  'T-MJ-012': 88,
  'T-MJ-012L': 102,
  'T-PZ-207': 410,
  'T-PZ-207N': 485,
  'T-ZD-088': 180,
  'T-DL-041': 65,
  'T-AM-055': 360,
  'T-KG-093': 55,
};

function partPrice(code: string): number {
  return PART_PRICES[code] ?? 100;
}

function partName(code: string): string {
  const map: Record<string, string> = {
    'T-YK-003': '曳引轮油封（原配）',
    'T-YK-003-B': '曳引轮油封（加厚兼容款）',
    'T-MJ-012': '门机皮带',
    'T-MJ-012L': '门机皮带（长距款）',
    'T-PZ-207': '平层感应器',
    'T-PZ-207N': '平层感应器（升级版）',
    'T-ZD-088': '制动闸瓦',
    'T-DL-041': '底坑缓冲垫',
    'T-AM-055': '安全钳楔块',
    'T-KG-093': '开关门限位开关',
  };
  return map[code] ?? code;
}

interface CreateOverridePayload {
  itemId: string;
  batchId: string;
  reason: string;
  impactExplanation: string;
  before: { partNo: string; partName: string; qty: number };
  after: { partNo: string; partName: string; qty: number };
  createdBy: string;
}

export interface CreateOverrideResult {
  override: OverrideRecord;
  impactedItem: ScheduleItem;
  action?: ReplaceAction;
}

function buildImpactChain(
  override: OverrideRecord,
  item: ScheduleItem,
): ImpactNode[] {
  const before = override.before;
  const after = override.after;
  const priceBefore = partPrice(before.partNo);
  const priceAfter = partPrice(after.partNo);
  const deltaValue = after.qty * priceAfter - before.qty * priceBefore;

  const n0: ImpactNode = {
    id: `node-override-${override.id}`,
    level: 'override',
    label: `人工改判 · 复核人 ${override.createdBy}`,
    detail: `原因：${override.reason}`,
    childrenIds: [`node-item-${item.id}`],
  };

  const n1: ImpactNode = {
    id: `node-item-${item.id}`,
    level: 'item',
    label: `影响排程行 ${item.elevatorNo} · ${item.faultCode}`,
    detail: `备件号：${before.partNo} × ${before.qty} → ${after.partNo} × ${after.qty}`,
    deltaValue,
    childrenIds: [`node-part-${after.partNo}`],
  };

  const n2: ImpactNode = {
    id: `node-part-${after.partNo}`,
    level: 'part',
    label: `备件型号替换影响`,
    detail: `单价 ￥${priceBefore} → ￥${priceAfter}，数量 ${before.qty} → ${after.qty}，行内差额 ￥${deltaValue}`,
    deltaValue,
    childrenIds: ['node-monthly-summary'],
  };

  const n3: ImpactNode = {
    id: 'node-monthly-summary',
    level: 'monthly_summary',
    label: '月度汇总影响 · 平均值暴露',
    detail: `改判拉动差额 ￥${deltaValue}，原平均值已掩盖此异常。`,
    deltaValue,
    childrenIds: [],
  };

  return [n0, n1, n2, n3];
}

export function createOverride(payload: CreateOverridePayload): CreateOverrideResult | null {
  const { itemId, batchId, reason, impactExplanation, before, after, createdBy } = payload;

  const item = store.items.find((it) => it.id === itemId && it.batchId === batchId);
  if (!item) return null;

  const batch = store.batches.find((b) => b.batchId === batchId);
  if (!batch) return null;

  const overrideId = `ov-${Date.now()}`;
  const now = new Date().toISOString().slice(0, 16).replace('T', ' ');

  const priceBefore = partPrice(before.partNo);
  const priceAfter = partPrice(after.partNo);
  const deltaValue = after.qty * priceAfter - before.qty * priceBefore;

  const override: OverrideRecord = {
    id: overrideId,
    itemId,
    batchId,
    createdAt: now,
    createdBy,
    reason,
    impactExplanation,
    before,
    after,
    impactChain: [],
  };

  override.impactChain = buildImpactChain(override, item);

  item.isOverridden = true;
  item.overrideId = overrideId;
  item.finalPartNo = after.partNo;
  item.finalPartName = after.partName || partName(after.partNo);
  item.finalQty = after.qty;
  item.monthlyImpactAfter = item.monthlyImpactBefore + deltaValue;

  let action: ReplaceAction | undefined;
  if (before.partNo !== after.partNo || before.qty !== after.qty) {
    const actionId = `act-${Date.now()}`;
    const dueDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    action = {
      id: actionId,
      overrideId,
      batchId,
      oldPartNo: before.partNo,
      oldPartName: before.partName || partName(before.partNo),
      newPartNo: after.partNo,
      newPartName: after.partName || partName(after.partNo),
      qty: after.qty,
      targetWarehouse: '待分配',
      assignee: '待分配',
      dueDate,
      status: 'pending',
    };
    store.replaceActions.push(action);
  }

  batch.overrideCount = (batch.overrideCount || 0) + 1;
  batch.status = 'overridden';

  store.overrides.push(override);

  return {
    override,
    impactedItem: item,
    action,
  };
}

export interface ImpactSummary {
  override: OverrideRecord;
  item: ScheduleItem | undefined;
  deltaTotal: number;
  deltaItem: number;
  deltaPart: number;
  deltaMonthly: number;
}

export function getImpact(overrideId: string): ImpactSummary | null {
  const override = store.overrides.find((o) => o.id === overrideId);
  if (!override) return null;

  const item = store.items.find((it) => it.id === override.itemId);

  let deltaItem = 0;
  let deltaPart = 0;
  let deltaMonthly = 0;

  for (const node of override.impactChain) {
    if (node.level === 'item') deltaItem = node.deltaValue ?? 0;
    if (node.level === 'part') deltaPart = node.deltaValue ?? 0;
    if (node.level === 'monthly_summary') deltaMonthly = node.deltaValue ?? 0;
  }

  const priceBefore = partPrice(override.before.partNo);
  const priceAfter = partPrice(override.after.partNo);
  const deltaTotal =
    override.after.qty * priceAfter - override.before.qty * priceBefore;

  return {
    override,
    item,
    deltaTotal,
    deltaItem,
    deltaPart,
    deltaMonthly,
  };
}
