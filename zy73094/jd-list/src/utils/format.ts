import type { ItemStatus, Conclusion } from '../types';

export const statusLabel: Record<ItemStatus, string> = {
  confirmed: '已确认·可施工',
  supplement_pending: '待补BIM备注',
  override_pending: '人工改判待复核',
  change_late: '变更单晚到',
  gap: '资料缺口'
};

export const statusTone: Record<ItemStatus, string> = {
  confirmed: 'bg-emerald-50 text-ok border-emerald-200',
  supplement_pending: 'bg-amber-50 text-warn border-amber-200',
  override_pending: 'bg-rose-50 text-bad border-rose-200',
  change_late: 'bg-orange-50 text-orange-700 border-orange-200',
  gap: 'bg-slate-100 text-muted border-slate-300'
};

export function clashLabel(r: Conclusion['clashRisk']) {
  return { none: '无冲突', low: '低风险', medium: '中风险', high: '高冲突' }[r];
}

export function clashTone(r: Conclusion['clashRisk']) {
  return {
    none: 'text-ok',
    low: 'text-sky-600',
    medium: 'text-warn',
    high: 'text-bad'
  }[r];
}

/** 计算进度数字 */
export function progressOf(items: { status: ItemStatus }[]) {
  const total = items.length;
  const done = items.filter(i => i.status === 'confirmed').length;
  const pending = items.filter(i => i.status !== 'confirmed').length;
  return { total, done, pending, percent: total ? Math.round((done / total) * 100) : 0 };
}

/** 缺口列表（给项目经理读） */
export function gapsOf(items: { status: ItemStatus; code: string }[]) {
  return items
    .filter(i => i.status !== 'confirmed')
    .map(i => ({ code: i.code, gap: statusLabel[i.status] }));
}
