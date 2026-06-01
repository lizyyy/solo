import { Scheme } from '@/types';

export const mockSchemes: Scheme[] = [
  {
    id: 'scheme-v1-001',
    name: 'V1方案',
    pointId: 'rc-001',
    description: '初始方案：舞台区对称布置4个反射舱',
    coordinates: { x: 3.5, y: 2.0, z: 2.0 }
  },
  {
    id: 'scheme-v1-002',
    name: 'V1方案',
    pointId: 'rc-002',
    description: '初始方案：舞台区对称布置4个反射舱',
    coordinates: { x: 6.5, y: 2.0, z: 2.0 }
  },
  {
    id: 'scheme-v2-004',
    name: 'V2方案',
    pointId: 'rc-004',
    description: '优化方案：增加后区反射舱，提升环绕感',
    coordinates: { x: 5.0, y: 3.0, z: 7.5 }
  },
  {
    id: 'scheme-v2-007',
    name: 'V2方案',
    pointId: 'rc-007',
    description: '优化方案：侧舱位置调整，老王手改过坐标',
    coordinates: { x: 2.8, y: 1.5, z: 3.0 }
  }
];
