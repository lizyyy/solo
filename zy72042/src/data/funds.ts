import type { FundAsset } from '@/types'

export const FUND_ASSETS: FundAsset[] = [
  {
    id: 'equity-growth',
    name: '成长股票基金',
    category: 'equity',
    riskFactor: 0.85,
    scoreFactor: 140,
    costPerUnit: 15,
    color: '#D32F2F',
  },
  {
    id: 'equity-value',
    name: '价值股票基金',
    category: 'equity',
    riskFactor: 0.75,
    scoreFactor: 120,
    costPerUnit: 12,
    color: '#E53935',
  },
  {
    id: 'bond-gov',
    name: '国债债券基金',
    category: 'bond',
    riskFactor: 0.15,
    scoreFactor: 60,
    costPerUnit: 8,
    color: '#1565C0',
  },
  {
    id: 'bond-corp',
    name: '企业债基金',
    category: 'bond',
    riskFactor: 0.35,
    scoreFactor: 88,
    costPerUnit: 10,
    color: '#1E88E5',
  },
  {
    id: 'money-market',
    name: '货币市场基金',
    category: 'money',
    riskFactor: 0.05,
    scoreFactor: 32,
    costPerUnit: 5,
    color: '#388E3C',
  },
  {
    id: 'mixed-balanced',
    name: '平衡混合基金',
    category: 'mixed',
    riskFactor: 0.5,
    scoreFactor: 100,
    costPerUnit: 11,
    color: '#E65100',
  },
  {
    id: 'mixed-aggressive',
    name: '进取混合基金',
    category: 'mixed',
    riskFactor: 0.65,
    scoreFactor: 112,
    costPerUnit: 13,
    color: '#F57C00',
  },
]

export const FUND_CATEGORY_LABELS: Record<string, string> = {
  equity: '股票型',
  bond: '债券型',
  money: '货币型',
  mixed: '混合型',
}

export const FUND_CATEGORY_COLORS: Record<string, string> = {
  equity: '#D32F2F',
  bond: '#1565C0',
  money: '#388E3C',
  mixed: '#E65100',
}
