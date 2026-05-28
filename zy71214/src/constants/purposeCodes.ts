import { PurposeCodeRule } from '@/types';

export const PURPOSE_CODE_RULES: PurposeCodeRule[] = [
  {
    code: '121010',
    name: '货物贸易',
    category: '经常项目',
    keywords: ['货物', '贸易', '进口', '出口', '商品', '货物贸易', '原材料', '设备', '货款'],
  },
  {
    code: '122010',
    name: '服务贸易',
    category: '经常项目',
    keywords: ['服务', '运输', '旅游', '咨询', '技术服务', '服务费', '咨询费', '海运费', '空运费'],
  },
  {
    code: '123010',
    name: '收益',
    category: '经常项目',
    keywords: ['收益', '工资', '利润', '股息', '红利', '利息', '薪酬', '劳务报酬'],
  },
  {
    code: '124010',
    name: '经常转移',
    category: '经常项目',
    keywords: ['经常转移', '捐赠', '赔偿', '赡养费', '遗产', '税款', '罚款'],
  },
  {
    code: '221010',
    name: '直接投资',
    category: '资本项目',
    keywords: ['直接投资', '设立', '并购', '增资', '撤资', '股权投资', '投资款'],
  },
  {
    code: '222010',
    name: '证券投资',
    category: '资本项目',
    keywords: ['证券投资', '股票', '债券', '基金', '权证', '理财产品'],
  },
  {
    code: '223010',
    name: '其他投资',
    category: '资本项目',
    keywords: ['其他投资', '贷款', '存款', '金融租赁', '垫款', '借款'],
  },
];

export const STATUS_LABELS: Record<string, string> = {
  pending: '待审核',
  processing: '审核中',
  issue_found: '发现问题',
  supplementing: '补录中',
  pending_review: '待复核',
  duplicate_check: '重复待核实',
  confirmed: '已确认',
  withdrawn: '已撤回',
  rejected: '已拒绝',
  closed: '已关闭',
};

export const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-700 border-slate-300',
  processing: 'bg-blue-100 text-blue-700 border-blue-300',
  issue_found: 'bg-amber-100 text-amber-700 border-amber-300',
  supplementing: 'bg-orange-100 text-orange-700 border-orange-300',
  pending_review: 'bg-indigo-100 text-indigo-700 border-indigo-300',
  duplicate_check: 'bg-purple-100 text-purple-700 border-purple-300',
  confirmed: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  withdrawn: 'bg-gray-100 text-gray-700 border-gray-300',
  rejected: 'bg-red-100 text-red-700 border-red-300',
  closed: 'bg-slate-100 text-slate-600 border-slate-300',
};

export const ISSUE_TYPE_LABELS: Record<string, string> = {
  purpose_mismatch: '用途代码不匹配',
  supplement_covers: '补件覆盖原件',
  duplicate_remittance: '同合同重复汇款',
  amount_mismatch: '金额不一致',
  date_invalid: '日期无效',
  document_missing: '材料缺失',
  manual_marked: '人工标注',
};

export const ISSUE_TYPE_COLORS: Record<string, string> = {
  purpose_mismatch: 'bg-rose-50 border-rose-200 text-rose-700',
  supplement_covers: 'bg-amber-50 border-amber-200 text-amber-700',
  duplicate_remittance: 'bg-purple-50 border-purple-200 text-purple-700',
  amount_mismatch: 'bg-orange-50 border-orange-200 text-orange-700',
  date_invalid: 'bg-yellow-50 border-yellow-200 text-yellow-700',
  document_missing: 'bg-red-50 border-red-200 text-red-700',
  manual_marked: 'bg-slate-50 border-slate-200 text-slate-700',
};

export const SEVERITY_LABELS: Record<string, string> = {
  low: '低',
  medium: '中',
  high: '高',
};

export const SEVERITY_COLORS: Record<string, string> = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-red-100 text-red-700',
};

export const RISK_COLORS: Record<string, string> = {
  normal: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
};

export const ACTION_LABELS: Record<string, string> = {
  create: '创建业务',
  submit: '提交审核',
  detect_issue: '发现问题',
  request_supplement: '请求补件',
  upload_supplement: '上传补件',
  recheck: '重新校验',
  review_pass: '复核通过',
  review_reject: '复核退回',
  confirm: '最终确认',
  withdraw: '撤回确认',
  resubmit: '重新提交',
  export: '导出报告',
};

export const getPurposeName = (code: string): string => {
  const rule = PURPOSE_CODE_RULES.find((r) => r.code === code);
  return rule?.name || code;
};

export const getPurposeCategory = (code: string): string => {
  const rule = PURPOSE_CODE_RULES.find((r) => r.code === code);
  return rule?.category || '未分类';
};
