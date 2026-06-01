import type { LevelConfig } from '@/types'

export const LEVELS: LevelConfig[] = [
  {
    id: 'smooth-a',
    name: '晨间拿铁',
    type: 'smooth',
    description: '资源充裕的入门关卡，按推荐配比即可顺利通关。适合第一次接触基金组合的玩家。',
    targetScore: 75,
    riskLimit: 0.6,
    timeLimit: 300,
    initialResources: 100,
    availableFundIds: ['bond-gov', 'mixed-balanced', 'money-market', 'equity-value'],
    hint: '试试债券型40% + 混合型35% + 货币型25%',
  },
  {
    id: 'rework-b',
    name: '午后美式',
    type: 'rework',
    description: '资源受限，首次配比容易触发风险超限，需要返工调整。模拟真实课堂中常见的"先错后改"场景。',
    targetScore: 80,
    riskLimit: 0.5,
    timeLimit: 90,
    initialResources: 80,
    availableFundIds: ['equity-growth', 'equity-value', 'bond-corp', 'money-market'],
    hint: '全仓股票型会让风险爆表，试试减仓股票加仓债券',
  },
  {
    id: 'boundary-c',
    name: '黄昏摩卡',
    type: 'boundary',
    description: '分数卡在达标线边缘，需要精细配比。触发边界分数例外，考验对分数系数的理解。',
    targetScore: 70,
    riskLimit: 0.55,
    timeLimit: 100,
    initialResources: 60,
    availableFundIds: ['equity-value', 'bond-corp', 'mixed-balanced', 'money-market'],
    hint: '差1分就达标或差1分不达标，边界就在眼前',
  },
  {
    id: 'free-d',
    name: '深夜特调',
    type: 'free',
    description: '自由组合关卡，没有固定答案。在限定资源和风险红线内，争取最高分数。',
    targetScore: 85,
    riskLimit: 0.55,
    timeLimit: 150,
    initialResources: 120,
    availableFundIds: ['equity-growth', 'equity-value', 'bond-gov', 'bond-corp', 'money-market', 'mixed-balanced', 'mixed-aggressive'],
  },
]

export const LEVEL_TYPE_LABELS: Record<string, string> = {
  smooth: '顺利流',
  rework: '返工流',
  boundary: '边界流',
  free: '自由流',
}

export const LEVEL_TYPE_COLORS: Record<string, string> = {
  smooth: '#388E3C',
  rework: '#F57C00',
  boundary: '#FBC02D',
  free: '#1565C0',
}
