import { Season } from '../types';

export const SEASONS: Season[] = [
  {
    id: 'spring',
    name: '春季',
    treeHeightFactor: 0.8,
    foliageDensity: 0.5,
    sunAngle: 45,
    color: '#90EE90'
  },
  {
    id: 'summer',
    name: '夏季',
    treeHeightFactor: 1.0,
    foliageDensity: 1.0,
    sunAngle: 65,
    color: '#228B22'
  },
  {
    id: 'autumn',
    name: '秋季',
    treeHeightFactor: 0.9,
    foliageDensity: 0.7,
    sunAngle: 40,
    color: '#DAA520'
  },
  {
    id: 'winter',
    name: '冬季',
    treeHeightFactor: 0.6,
    foliageDensity: 0.2,
    sunAngle: 25,
    color: '#F0F8FF'
  }
];
