import type {
  WorkType,
  WorkStatus,
  HandoverStatus,
  Unit,
  MaterialStatus,
  RecallTag,
  ExceptionCategory,
  ProcessStatus,
} from '@/types';

export const WORK_TYPES: readonly WorkType[] = [
  '例行检修',
  '故障维修',
  '专项改造',
  '补录记录',
] as const;

export const WORK_STATUS: readonly WorkStatus[] = [
  '待处理',
  '处理中',
  '异常撤回',
  '缺材料',
  '可放行',
  '已完成',
] as const;

export const HANDOVER_STATUS: readonly HandoverStatus[] = [
  '待交接',
  '可放行',
  '缺材料待补',
  '异常待核',
] as const;

export const UNITS: readonly Unit[] = ['个', '套', '米', '公斤', '箱', '卷'] as const;

export const MATERIAL_STATUS: readonly MaterialStatus[] = [
  '正常',
  '缺料',
  '待核',
  '单位异常',
  '阈值异常',
  '公式异常',
] as const;

export const RECALL_TAGS: readonly RecallTag[] = [
  '正常',
  '公式问题',
  '单位问题',
  '阈值问题',
] as const;

export const EXCEPTION_CATEGORIES: readonly ExceptionCategory[] = [
  '公式问题',
  '单位问题',
  '阈值问题',
  '数据缺失',
] as const;

export const PROCESS_STATUS: readonly ProcessStatus[] = [
  '待处理',
  '处理中',
  '已修正',
  '需人工确认',
] as const;

export const STATUS_COLOR_MAP: Record<HandoverStatus, string> = {
  待交接: 'bg-slate-500',
  可放行: 'bg-emerald-600',
  缺材料待补: 'bg-amber-500',
  异常待核: 'bg-rose-600',
};

export const STATUS_TEXT_COLOR_MAP: Record<HandoverStatus, string> = {
  待交接: 'text-slate-300',
  可放行: 'text-emerald-400',
  缺材料待补: 'text-amber-400',
  异常待核: 'text-rose-400',
};

export const CATEGORY_EMOJI: Record<ExceptionCategory | RecallTag, string> = {
  公式问题: '🔴',
  单位问题: '🟠',
  阈值问题: '🟣',
  数据缺失: '🟡',
  正常: '✅',
};

export const CATEGORY_COLOR: Record<ExceptionCategory | RecallTag, string> = {
  公式问题: 'border-rose-500 bg-rose-500/10 text-rose-300',
  单位问题: 'border-orange-500 bg-orange-500/10 text-orange-300',
  阈值问题: 'border-violet-500 bg-violet-500/10 text-violet-300',
  数据缺失: 'border-yellow-500 bg-yellow-500/10 text-yellow-300',
  正常: 'border-emerald-500 bg-emerald-500/10 text-emerald-300',
};
