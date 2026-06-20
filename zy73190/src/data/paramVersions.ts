import type { ParamVersion } from '@/types';

export const paramVersions: ParamVersion[] = [
  {
    id: 'v1.0',
    name: 'v1.0 基础版',
    formula: 'a(n) = a(n-1) × A + a(n-2) × B + C',
    threshold: 5,
    description: '初始版本，使用基础递推公式，允许5%以内偏差',
    params: {
      a: 1.5,
      b: -0.5,
      c: 2,
    },
    createdAt: '2026-06-15 09:00:00',
  },
  {
    id: 'v1.1',
    name: 'v1.1 修正版',
    formula: 'a(n) = a(n-1) × A + a(n-2) × B + C',
    threshold: 3,
    description: '收紧阈值至3%，参数B微调以修正边界情况',
    params: {
      a: 1.5,
      b: -0.6,
      c: 2,
    },
    createdAt: '2026-06-18 14:30:00',
  },
];
