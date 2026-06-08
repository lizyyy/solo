import type { FollowUpRecord } from '@/types';

export const WEIGHT_UNIT_PATTERNS = [
  { unit: 'kg', regex: /(kg|千克|公斤)/i },
  { unit: 'lb', regex: /(lb|磅|pound)/i },
  { unit: 'g', regex: /(g|克)/i },
];

export interface ParsedWeight {
  value: number | null;
  unit: 'kg' | 'lb' | 'g' | 'unknown';
  raw: string;
}

export function parseWeight(raw: string): ParsedWeight {
  if (!raw) return { value: null, unit: 'unknown', raw };
  const text = String(raw).trim();
  const numMatch = text.match(/-?\d+(\.\d+)?/);
  const value = numMatch ? parseFloat(numMatch[0]) : null;

  let unit: ParsedWeight['unit'] = 'unknown';
  for (const p of WEIGHT_UNIT_PATTERNS) {
    if (p.regex.test(text)) {
      unit = p.unit as ParsedWeight['unit'];
      break;
    }
  }
  return { value, unit, raw };
}

export function isWeightUnitMixed(a: string, b: string): boolean {
  const pa = parseWeight(a);
  const pb = parseWeight(b);
  if (pa.unit === 'unknown' || pb.unit === 'unknown') return false;
  return pa.unit !== pb.unit;
}

export const CALC_RULES = [
  {
    version: 'v1.2',
    name: '寄养回访追踪算法 · 计算口径（v1.2）',
    rules: [
      '旧记录来源：宠物医院 HIS 系统，字段：姓名/电话/品种/体重/入住日期',
      '新记录来源：本次前台手写寄养登记表 OCR + 人工复核录入',
      '字段容差：品种名"金毛" vs "金毛巡回犬"视为可疑但不自动合并，交由人工复核',
      '体重容差：同一单位下差异 > 0.3kg 视为体重不符；跨单位视为"单位混写"，自动挂起不做换算',
      '日期容差：入住 / 出院日期任何差异均标记异常',
      '补录备注：前台备注中出现"补送/改期/划改/手误"等词时，即使日期等字段差异不直接放行，升级待复核人确认',
    ],
    released: [
      '算法值班人确认：所有异常标签全部通过后，状态更新为"已放行"',
      '历史追溯面板保留每一次改判，包含旧快照+新备注+改判原因+操作人',
    ],
  },
];

export function getCalcRule(version: string) {
  return CALC_RULES.find((r) => r.version === version) ?? CALC_RULES[0];
}

export function exportRecordsToCSV(records: FollowUpRecord[]) {
  const header = [
    '追踪号',
    '宠物名',
    '主人',
    '状态',
    '异常类型',
    '差异字段',
    '体重单位混写',
    '口径版本',
    '创建时间',
    '备注',
  ];
  const lines = [header.join(',')];
  for (const r of records) {
    lines.push(
      [
        r.id,
        (r.newSnapshot.petName ?? '').replace(/,/g, '，'),
        (r.newSnapshot.ownerName ?? '').replace(/,/g, '，'),
        r.status,
        r.abnormalTypes.join('/'),
        r.diffFields.join('/'),
        r.weightUnitMixed ? '是' : '否',
        r.calcRuleVersion,
        r.createdAt,
        (r.remark ?? '').replace(/,/g, '，').replace(/\n/g, ' '),
      ].join(','),
    );
  }
  return '\uFEFF' + lines.join('\n');
}

export function downloadCSV(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}
