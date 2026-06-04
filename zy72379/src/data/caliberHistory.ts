import type { CaliberHistory } from '@/types';

export const caliberHistory: CaliberHistory[] = [
  {
    version: 'v1.0',
    effectiveDate: '2024-01-15',
    conversionFactor: 1.0,
    fromUnit: 'με',
    toUnit: 'με',
    description: '初始口径 - 微应变直接读取',
    operator: '系统初始化',
  },
  {
    version: 'v1.1',
    effectiveDate: '2024-03-20',
    conversionFactor: 1e-6,
    fromUnit: 'με',
    toUnit: 'mm/mm',
    description: '新增微应变转应变换算口径',
    operator: '林老师',
  },
  {
    version: 'v1.2',
    effectiveDate: '2024-06-10',
    conversionFactor: 1000,
    fromUnit: 'mm/mm',
    toUnit: 'με',
    description: '新增应变转微应变换算口径',
    operator: '林老师',
  },
  {
    version: 'v2.0',
    effectiveDate: '2024-09-01',
    conversionFactor: 1e-6,
    fromUnit: 'με',
    toUnit: '%',
    description: '微应变转百分比应变（旧口径，已废弃',
    operator: '林老师',
  },
  {
    version: 'v2.1',
    effectiveDate: '2025-02-15',
    conversionFactor: 1e-4,
    fromUnit: 'με',
    toUnit: '%',
    description: '修正微应变转百分比应变口径',
    operator: '林老师',
  },
  {
    version: 'v3.0',
    effectiveDate: '2025-08-01',
    conversionFactor: 1.0,
    fromUnit: 'kN',
    toUnit: 'MPa',
    description: '力值单位换算（需截面积100mm²）',
    operator: '林老师',
  },
  {
    version: 'v3.1',
    effectiveDate: '2026-01-10',
    conversionFactor: 0.01,
    fromUnit: 'kN',
    toUnit: 'MPa',
    description: '力值单位换算（需截面积10000mm²）',
    operator: '林老师',
  },
];

export const getLatestCaliber = (fromUnit: string, toUnit: string): CaliberHistory | undefined => {
  return caliberHistory
    .filter(c => c.fromUnit === fromUnit && c.toUnit === toUnit && !c.description.includes('废弃'))
    .sort((a, b) => new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime())[0];
};

export const getCaliberByDate = (fromUnit: string, toUnit: string, date: string): CaliberHistory | undefined => {
  const targetDate = new Date(date).getTime();
  return caliberHistory
    .filter(c => 
      c.fromUnit === fromUnit && 
      c.toUnit === toUnit && 
      new Date(c.effectiveDate).getTime() <= targetDate
    )
    .sort((a, b) => new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime())[0];
};
