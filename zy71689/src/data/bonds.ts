import type { Bond, BondHolding, RatingLevel } from '@/types';
import { getRiskWeight } from './constants';

export const BONDS: Bond[] = [
  {
    id: 'bond-001',
    code: '24国开01',
    name: '2024年国家开发银行第一期金融债券',
    issuer: '国家开发银行',
    faceValue: 100,
    couponRate: 2.85,
    maturityDate: '2034-01-15',
  },
  {
    id: 'bond-002',
    code: '24农发03',
    name: '2024年中国农业发展银行第三期金融债券',
    issuer: '中国农业发展银行',
    faceValue: 100,
    couponRate: 3.05,
    maturityDate: '2029-06-20',
  },
  {
    id: 'bond-003',
    code: '24进出05',
    name: '2024年中国进出口银行第五期金融债券',
    issuer: '中国进出口银行',
    faceValue: 100,
    couponRate: 2.95,
    maturityDate: '2031-03-10',
  },
  {
    id: 'bond-004',
    code: '24万科01',
    name: '2024年万科企业股份有限公司公司债券',
    issuer: '万科企业股份有限公司',
    faceValue: 100,
    couponRate: 4.25,
    maturityDate: '2027-08-15',
  },
  {
    id: 'bond-005',
    code: '24碧桂02',
    name: '2024年碧桂园控股有限公司公司债券',
    issuer: '碧桂园控股有限公司',
    faceValue: 100,
    couponRate: 5.85,
    maturityDate: '2026-11-30',
  },
  {
    id: 'bond-006',
    code: '24华能01',
    name: '2024年华能集团有限公司绿色债券',
    issuer: '中国华能集团有限公司',
    faceValue: 100,
    couponRate: 3.55,
    maturityDate: '2032-05-25',
  },
  {
    id: 'bond-007',
    code: '24万达03',
    name: '2024年大连万达商业管理集团股份有限公司公司债券',
    issuer: '大连万达商业管理集团股份有限公司',
    faceValue: 100,
    couponRate: 6.95,
    maturityDate: '2025-12-18',
  },
  {
    id: 'bond-008',
    code: '24茅台01',
    name: '2024年贵州茅台酒股份有限公司公司债券',
    issuer: '贵州茅台酒股份有限公司',
    faceValue: 100,
    couponRate: 2.65,
    maturityDate: '2029-09-01',
  },
];

export const generateInitialPortfolio = (): BondHolding[] => {
  const initialRatings: Record<string, RatingLevel> = {
    'bond-001': 'AAA',
    'bond-002': 'AAA',
    'bond-003': 'AAA',
    'bond-004': 'AA',
    'bond-005': 'BBB',
    'bond-006': 'AA',
    'bond-007': 'B',
    'bond-008': 'AAA',
  };

  const initialMarketValues: Record<string, number> = {
    'bond-001': 102.5,
    'bond-002': 101.8,
    'bond-003': 102.1,
    'bond-004': 98.5,
    'bond-005': 85.2,
    'bond-006': 100.5,
    'bond-007': 68.8,
    'bond-008': 103.2,
  };

  const positions: Record<string, number> = {
    'bond-001': 200000,
    'bond-002': 150000,
    'bond-003': 150000,
    'bond-004': 100000,
    'bond-005': 80000,
    'bond-006': 120000,
    'bond-007': 50000,
    'bond-008': 150000,
  };

  return BONDS.map((bond) => {
    const rating = initialRatings[bond.id] || 'BBB';
    const marketValue = initialMarketValues[bond.id] || 100;
    const position = positions[bond.id] || 100000;
    const riskWeight = getRiskWeight(rating);
    const adjustedValue = (marketValue * position * riskWeight) / 100;

    return {
      id: `holding-${bond.id}-${Date.now()}`,
      bondId: bond.id,
      bondCode: bond.code,
      bondName: bond.name,
      currentRating: rating,
      previousRating: rating,
      faceValue: bond.faceValue,
      marketValue,
      position,
      riskWeight,
      adjustedValue,
    };
  });
};
