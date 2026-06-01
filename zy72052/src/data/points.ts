import { Point } from '@/types';

export const HALL_BOUNDS = {
  minX: 0, maxX: 10,
  minY: 0, maxY: 5,
  minZ: 0, maxZ: 10
};

export const mockPoints: Point[] = [
  {
    id: 'rc-001',
    name: 'RC-001',
    type: 'reflection-chamber',
    x: 3.5, y: 2.0, z: 2.0,
    status: 'normal',
    inspectionDate: '2024-12-01',
    isReflectionChamber: true,
    notes: '主舞台左侧反射舱，V1方案确认位置',
    schemeVersion: 'v1',
    participatesInRayPath: true
  },
  {
    id: 'rc-002',
    name: 'RC-002',
    type: 'reflection-chamber',
    x: 6.5, y: 2.0, z: 2.0,
    status: 'normal',
    inspectionDate: '2024-12-01',
    isReflectionChamber: true,
    notes: '主舞台右侧反射舱，声线路径关键节点',
    schemeVersion: 'v1',
    participatesInRayPath: true
  },
  {
    id: 'rc-003',
    name: 'RC-003',
    type: 'reflection-chamber',
    x: 5.0, y: 1.5, z: null,
    status: 'empty',
    inspectionDate: '2024-12-02',
    isReflectionChamber: true,
    notes: '哎，这个Z坐标没填，林老师你看看原始记录表',
    schemeVersion: 'v1'
  },
  {
    id: 'rc-004',
    name: 'RC-004',
    type: 'reflection-chamber',
    x: 5.0, y: 3.0, z: 7.5,
    status: 'normal',
    inspectionDate: '2024-12-03',
    isReflectionChamber: true,
    notes: '观众席后区反射舱，参与声线反射',
    schemeVersion: 'v2',
    participatesInRayPath: true
  },
  {
    id: 'rc-005',
    name: 'RC-005',
    type: 'reflection-chamber',
    x: 2.0, y: 2.5, z: 5.0,
    status: 'duplicate',
    inspectionDate: '2024-12-02',
    isReflectionChamber: true,
    notes: '这个点位和RC-005-dup重复了，谁导入了两次？',
    schemeVersion: 'v1'
  },
  {
    id: 'rc-005-dup',
    name: 'RC-005-dup',
    type: 'reflection-chamber',
    x: 2.0, y: 2.5, z: 5.0,
    status: 'duplicate',
    inspectionDate: '2024-12-02',
    isReflectionChamber: true,
    notes: '重复导入的记录，建议删除这条',
    schemeVersion: 'v1'
  },
  {
    id: 'rc-007',
    name: 'RC-007',
    type: 'reflection-chamber',
    x: 2.8, y: 1.5, z: 3.0,
    status: 'error',
    inspectionDate: '2024-12-04',
    isReflectionChamber: true,
    notes: '这个有冲突！照片和点位表对不上，你瞅瞅',
    schemeVersion: 'v2',
    manualCoord: {
      x: 3.0, y: 1.6, z: 3.1,
      modifiedBy: '老王',
      reason: '现场量的，跟图纸有点差'
    },
    conflictWithPhoto: true,
    photoEvidence: {
      photoDesc: '2024-12-04 现场巡检照片_007.jpg',
      photoCoord: '(3.2, 1.8, 3.0)'
    }
  },
  {
    id: 'rc-009',
    name: 'RC-009',
    type: 'reflection-chamber',
    x: 9.8, y: 0.1, z: 4.9,
    status: 'boundary',
    inspectionDate: '2024-12-05',
    isReflectionChamber: true,
    notes: '边界记录！离右墙只剩0.2米，确认下是不是放错了',
    schemeVersion: 'v2'
  },
  {
    id: 'mic-01',
    name: 'MIC-01',
    type: 'microphone',
    x: 5.0, y: 1.2, z: 5.0,
    status: 'normal',
    inspectionDate: '2024-12-01',
    isReflectionChamber: false,
    notes: '主观众区拾音麦',
    schemeVersion: 'v1'
  },
  {
    id: 'spk-01',
    name: 'SPK-01',
    type: 'speaker',
    x: 5.0, y: 2.5, z: 1.0,
    status: 'normal',
    inspectionDate: '2024-12-01',
    isReflectionChamber: false,
    notes: '主扩声音源，声线从这出发',
    schemeVersion: 'v1'
  }
];
