import type { Level } from '../types';
import { businessRules } from './rules';

const baseTime = Date.now();

export const levels: Level[] = [
  {
    id: 'level-001',
    name: '期货仓单抢修队 - 基础演练',
    description: '包含5个典型仓单问题，覆盖正常操作、规则误解、操作超时、边界值和空值等测试场景。',
    rules: businessRules,
    problems: [
      {
        id: 'prob-001',
        order: 1,
        title: '仓单信息缺失',
        description: '收到一份仓单，发现货主联系方式缺失。此时应该如何处理？',
        timeLimit: 10,
        options: [
          { id: 'opt-001-a', label: 'A. 先补全信息，再办理入库', shortcut: '1' },
          { id: 'opt-001-b', label: 'B. 先入库，以后再说', shortcut: '2' },
          { id: 'opt-001-c', label: 'C. 直接退回给货主', shortcut: '3' },
        ],
        correctOptionId: 'opt-001-a',
        ruleReferences: ['RULE-001'],
        scoring: { correct: 20, wrong: -10, timeout: -5 },
      },
      {
        id: 'prob-002',
        order: 2,
        title: '质检不合格',
        description: '某批货物质检报告显示水分超标，不符合入库标准。此时应该如何处理？',
        timeLimit: 8,
        options: [
          { id: 'opt-002-a', label: 'A. 降低标准入库', shortcut: '1' },
          { id: 'opt-002-b', label: 'B. 退回货主重新处理', shortcut: '2' },
          { id: 'opt-002-c', label: 'C. 走绿色通道', shortcut: '3' },
        ],
        correctOptionId: 'opt-002-b',
        ruleReferences: ['RULE-002'],
        scoring: { correct: 20, wrong: -10, timeout: -5 },
      },
      {
        id: 'prob-003',
        order: 3,
        title: '货主信息不符',
        description: '办理入库时，发现经办人身份信息与系统登记的货主信息不符。此时应该如何处理？',
        timeLimit: 12,
        options: [
          { id: 'opt-003-a', label: 'A. 先核实身份，确认无误后处理', shortcut: '1' },
          { id: 'opt-003-b', label: 'B. 相信经办人，直接办理', shortcut: '2' },
          { id: 'opt-003-c', label: 'C. 拒绝办理，不解释原因', shortcut: '3' },
        ],
        correctOptionId: 'opt-003-a',
        ruleReferences: ['RULE-003'],
        scoring: { correct: 20, wrong: -10, timeout: -5 },
      },
      {
        id: 'prob-004',
        order: 4,
        title: '紧急情况处理',
        description: '一批生鲜货物即将变质，需要紧急入库，但部分手续不全。此时应该如何处理？',
        timeLimit: 15,
        options: [
          { id: 'opt-004-a', label: 'A. 等手续齐全再入库', shortcut: '1' },
          { id: 'opt-004-b', label: 'B. 走绿色通道，事后补审批', shortcut: '2' },
          { id: 'opt-004-c', label: 'C. 拒绝入库', shortcut: '3' },
        ],
        correctOptionId: 'opt-004-b',
        ruleReferences: ['RULE-004'],
        scoring: { correct: 20, wrong: -10, timeout: -5 },
      },
      {
        id: 'prob-005',
        order: 5,
        title: '信息完整的正常单',
        description: '收到一份仓单，所有信息完整，质检合格，货主信息无误。此时应该如何处理？',
        timeLimit: 6,
        options: [
          { id: 'opt-005-a', label: 'A. 正常办理入库手续', shortcut: '1' },
          { id: 'opt-005-b', label: 'B. 额外检查一遍再入库', shortcut: '2' },
          { id: 'opt-005-c', label: 'C. 退回确认', shortcut: '3' },
        ],
        correctOptionId: 'opt-005-a',
        ruleReferences: ['RULE-001'],
        scoring: { correct: 20, wrong: -10, timeout: -5 },
      },
    ],
    preRecordedChoices: [
      {
        problemId: 'prob-001',
        optionId: 'opt-001-a',
        responseTime: 3200,
        timestamp: baseTime + 5000,
      },
      {
        problemId: 'prob-002',
        optionId: 'opt-002-a',
        responseTime: 4500,
        timestamp: baseTime + 15000,
      },
      {
        problemId: 'prob-003',
        optionId: 'opt-003-a',
        responseTime: 12000,
        timestamp: baseTime + 25000,
      },
      {
        problemId: 'prob-004',
        optionId: 'opt-004-b',
        responseTime: 15000,
        timestamp: baseTime + 35000,
      },
      {
        problemId: 'prob-004',
        optionId: 'opt-004-b',
        responseTime: 15000,
        timestamp: baseTime + 35000,
      },
      {
        problemId: 'prob-005',
        optionId: null,
        responseTime: 0,
        timestamp: baseTime + 45000,
      },
    ],
    teacherNotes: [
      {
        timestamp: baseTime + 1000,
        content: '本题是典型的信息缺失场景，考察学员对 RULE-001 的掌握。',
        author: '李老师',
        problemId: 'prob-001',
      },
      {
        timestamp: baseTime + 2000,
        content: '注意区分"退回"和"补全信息"的适用场景。',
        author: '李老师',
        problemId: 'prob-002',
      },
    ],
  },
  {
    id: 'level-002',
    name: '期货仓单抢修队 - 边界值专项测试',
    description: '专门用于测试边界值、空值和重复项处理的专项关卡。',
    rules: businessRules,
    problems: [
      {
        id: 'prob-boundary-001',
        order: 1,
        title: '边界值测试 - 刚好超时',
        description: '测试响应时间刚好等于时间限制的边界情况。',
        timeLimit: 5,
        options: [
          { id: 'b-opt-001-a', label: 'A. 正确选项', shortcut: '1' },
          { id: 'b-opt-001-b', label: 'B. 错误选项', shortcut: '2' },
        ],
        correctOptionId: 'b-opt-001-a',
        ruleReferences: ['RULE-001'],
        scoring: { correct: 10, wrong: -5, timeout: -2 },
      },
      {
        id: 'prob-boundary-002',
        order: 2,
        title: '空值测试 - 未做选择',
        description: '测试 optionId 为 null 的空值处理。',
        timeLimit: 3,
        options: [
          { id: 'b-opt-002-a', label: 'A. 正确选项', shortcut: '1' },
          { id: 'b-opt-002-b', label: 'B. 错误选项', shortcut: '2' },
        ],
        correctOptionId: 'b-opt-002-a',
        ruleReferences: ['RULE-002'],
        scoring: { correct: 10, wrong: -5, timeout: -2 },
      },
    ],
    preRecordedChoices: [
      {
        problemId: 'prob-boundary-001',
        optionId: 'b-opt-001-a',
        responseTime: 5000,
        timestamp: baseTime + 1000,
      },
      {
        problemId: 'prob-boundary-002',
        optionId: null,
        responseTime: 0,
        timestamp: baseTime + 10000,
      },
      {
        problemId: 'prob-boundary-002',
        optionId: null,
        responseTime: 0,
        timestamp: baseTime + 10000,
      },
    ],
    teacherNotes: [
      {
        timestamp: baseTime + 500,
        content: '本题测试边界值判断逻辑：responseTime === timeLimit 时应判定为不超时。',
        author: '李老师',
        problemId: 'prob-boundary-001',
      },
    ],
  },
];

export function getLevelById(id: string): Level | undefined {
  return levels.find((l) => l.id === id);
}
