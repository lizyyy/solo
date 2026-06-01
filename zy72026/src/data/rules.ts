import type { BusinessRule } from '../types';

export const businessRules: BusinessRule[] = [
  {
    id: 'rule-001',
    code: 'RULE-001',
    title: '信息补全规则',
    description: '仓单信息不完整时，应先补全信息再入库，不得直接入库。',
  },
  {
    id: 'rule-002',
    code: 'RULE-002',
    title: '质检退回规则',
    description: '仓单质检不合格时，应退回货主重新处理，不得入库。',
  },
  {
    id: 'rule-003',
    code: 'RULE-003',
    title: '货主核实规则',
    description: '货主信息与系统不符时，需先核实身份，确认无误后再处理。',
  },
  {
    id: 'rule-004',
    code: 'RULE-004',
    title: '绿色通道规则',
    description: '紧急情况下可走绿色通道，但必须在24小时内补全审批手续。',
  },
  {
    id: 'rule-timeout-001',
    code: 'RULE-TIMEOUT-001',
    title: '操作时限规则',
    description: '每道操作必须在规定时间内完成，超时判定为操作失败。',
  },
];

export function getRuleByCode(code: string): BusinessRule | undefined {
  return businessRules.find((r) => r.code === code);
}
