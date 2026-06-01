import type { LevelConfig } from '@/types'

export const LEVEL_A: LevelConfig = {
  id: 'level-a',
  name: '初级校准',
  description: '电磁炮基础参数校准，适用于入门级学员。需要根据给定参数选择正确的校准方案。',
  roundCount: 5,
  roundTimeLimit: 30,
  parameters: [
    { roundNumber: 1, frequency: 2.4, power: 85, angle: 15, temperature: 22 },
    { roundNumber: 2, frequency: 3.6, power: 92, angle: 30, temperature: 25 },
    { roundNumber: 3, frequency: 5.0, power: 78, angle: 45, temperature: 28 },
    { roundNumber: 4, frequency: 4.2, power: 88, angle: 60, temperature: 20 },
    { roundNumber: 5, frequency: 1.8, power: 95, angle: 10, temperature: 18 },
  ],
  correctAnswers: {
    1: 'A',
    2: 'B',
    3: 'C',
    4: 'A',
    5: 'B',
  },
  options: {
    1: ['A: 增频降压', 'B: 减频增压', 'C: 维持不变', 'D: 紧急停机'],
    2: ['A: 降温增角', 'B: 增频调角', 'C: 降压减频', 'D: 维持不变'],
    3: ['A: 增频增压', 'B: 减频降压', 'C: 维持增角', 'D: 紧急停机'],
    4: ['A: 降温减角', 'B: 增频增压', 'C: 减频降压', 'D: 维持不变'],
    5: ['A: 减频降压', 'B: 增频增角', 'C: 维持不变', 'D: 紧急停机'],
  },
  scoringRules: [
    { id: 'wrong-choice', condition: 'playerChoice !== correctAnswer', deduction: 20, reason: '选择错误', detail: '校准方案选择与标准答案不符' },
    { id: 'no-choice', condition: 'playerChoice === null', deduction: 25, reason: '未选择', detail: '学员未在规定时间内做出选择' },
    { id: 'timeout', condition: 'source === timeout', deduction: 10, reason: '超时', detail: '回合超时未完成' },
    { id: 'duplicate-choice', condition: 'isDuplicate === true', deduction: 5, reason: '重复选择', detail: '连续多回合做出相同选择，可能存在随意答题' },
  ],
}

export const LEVEL_B: LevelConfig = {
  id: 'level-b',
  name: '进阶校准',
  description: '电磁炮复杂参数校准，参数波动大，需要综合判断多个变量。',
  roundCount: 6,
  roundTimeLimit: 25,
  parameters: [
    { roundNumber: 1, frequency: 6.2, power: 110, angle: 75, temperature: 35 },
    { roundNumber: 2, frequency: 7.8, power: 95, angle: 50, temperature: 40 },
    { roundNumber: 3, frequency: 8.5, power: 120, angle: 80, temperature: 45 },
    { roundNumber: 4, frequency: 5.5, power: 105, angle: 35, temperature: 30 },
    { roundNumber: 5, frequency: 9.0, power: 130, angle: 90, temperature: 50 },
    { roundNumber: 6, frequency: 4.0, power: 100, angle: 25, temperature: 38, extra: { humidity: 65 } },
  ],
  correctAnswers: {
    1: 'C',
    2: 'A',
    3: 'D',
    4: 'B',
    5: 'A',
    6: 'C',
  },
  options: {
    1: ['A: 增频增压', 'B: 减频降压', 'C: 降温调角', 'D: 紧急停机'],
    2: ['A: 增角增频', 'B: 减角减压', 'C: 降温降压', 'D: 维持不变'],
    3: ['A: 减频减角', 'B: 增频增压', 'C: 降温降压', 'D: 紧急停机并降温'],
    4: ['A: 维持不变', 'B: 微调增角', 'C: 减频减压', 'D: 降温降压'],
    5: ['A: 紧急降压降温', 'B: 增频增压', 'C: 减频减角', 'D: 维持不变'],
    6: ['A: 增频增角', 'B: 减频降压', 'C: 降温控湿', 'D: 紧急停机'],
  },
  scoringRules: [
    { id: 'wrong-choice', condition: 'playerChoice !== correctAnswer', deduction: 25, reason: '选择错误', detail: '校准方案选择与标准答案不符' },
    { id: 'no-choice', condition: 'playerChoice === null', deduction: 30, reason: '未选择', detail: '学员未在规定时间内做出选择' },
    { id: 'timeout', condition: 'source === timeout', deduction: 15, reason: '超时', detail: '回合超时未完成' },
    { id: 'duplicate-choice', condition: 'isDuplicate === true', deduction: 8, reason: '重复选择', detail: '连续多回合做出相同选择，可能存在随意答题' },
  ],
}

export const LEVEL_C: LevelConfig = {
  id: 'level-c',
  name: '极限校准',
  description: '电磁炮极限参数校准，参数接近危险阈值，考验学员的判断力和果断性。',
  roundCount: 4,
  roundTimeLimit: 20,
  parameters: [
    { roundNumber: 1, frequency: 12.0, power: 150, angle: 88, temperature: 60 },
    { roundNumber: 2, frequency: 0.5, power: 40, angle: 5, temperature: -10 },
    { roundNumber: 3, frequency: 15.0, power: 180, angle: 95, temperature: 75 },
    { roundNumber: 4, frequency: 10.0, power: 140, angle: 85, temperature: 55, extra: { humidity: 90, pressure: 1.5 } },
  ],
  correctAnswers: {
    1: 'D',
    2: 'C',
    3: 'D',
    4: 'A',
  },
  options: {
    1: ['A: 增频增压', 'B: 减频降压', 'C: 降温调角', 'D: 紧急停机'],
    2: ['A: 增频增压', 'B: 减频降压', 'C: 增温增角', 'D: 维持不变'],
    3: ['A: 降温降压', 'B: 增频增压', 'C: 减频减角', 'D: 紧急停机并全面降温'],
    4: ['A: 降压控湿降温', 'B: 增频增压', 'C: 减频减角', 'D: 维持不变'],
  },
  scoringRules: [
    { id: 'wrong-choice', condition: 'playerChoice !== correctAnswer', deduction: 30, reason: '选择错误', detail: '校准方案选择与标准答案不符，极限场景下错误判断风险极高' },
    { id: 'no-choice', condition: 'playerChoice === null', deduction: 35, reason: '未选择', detail: '学员未在规定时间内做出选择，极限场景不允许犹豫' },
    { id: 'timeout', condition: 'source === timeout', deduction: 20, reason: '超时', detail: '回合超时未完成' },
    { id: 'duplicate-choice', condition: 'isDuplicate === true', deduction: 10, reason: '重复选择', detail: '连续多回合做出相同选择，极限场景需要针对性判断' },
  ],
}

export const ALL_LEVELS: LevelConfig[] = [LEVEL_A, LEVEL_B, LEVEL_C]

export function getLevelById(id: string): LevelConfig | undefined {
  return ALL_LEVELS.find((l) => l.id === id)
}
