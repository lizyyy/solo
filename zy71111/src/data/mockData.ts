
import { InspectionData, CrackLevel, RecheckStatus, CameraPreset } from '../types';

const baseTime = Date.now() - 3600000;

export const mockInspectionData: InspectionData = {
  bladeId: 'BLD-2024-001',
  startTime: baseTime,
  endTime: baseTime + 1800000,
  annotations: [
    {
      id: 'ann-001',
      position: [0, 2.5, 0.3],
      crackLevel: CrackLevel.SEVERE,
      recheckStatus: RecheckStatus.PENDING,
      photoUrl: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=400&h=300&fit=crop',
      photoOrientation: 45,
      description: '叶尖前缘发现严重裂纹，长度约 15cm，需立即处理',
      timestamp: baseTime + 300000,
    },
    {
      id: 'ann-002',
      position: [-0.8, 0, 0.2],
      crackLevel: CrackLevel.MODERATE,
      recheckStatus: RecheckStatus.VERIFIED,
      photoUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop',
      photoOrientation: -30,
      description: '叶片中部表面磨损，面积约 80cm²',
      timestamp: baseTime + 600000,
    },
    {
      id: 'ann-003',
      position: [0.6, -1.8, 0.25],
      crackLevel: CrackLevel.LIGHT,
      recheckStatus: RecheckStatus.RESOLVED,
      photoUrl: 'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=400&h=300&fit=crop',
      photoOrientation: 90,
      description: '叶根附近轻微划痕，不影响结构安全',
      timestamp: baseTime + 900000,
    },
    {
      id: 'ann-004',
      position: [-0.3, 1.2, -0.28],
      crackLevel: CrackLevel.MODERATE,
      recheckStatus: RecheckStatus.PENDING,
      photoUrl: 'https://images.unsplash.com/photo-1581092921461-eab62e97a780?w=400&h=300&fit=crop',
      photoOrientation: 0,
      description: '后缘发现中度裂纹，建议下次巡检重点观察',
      timestamp: baseTime + 1200000,
    },
    {
      id: 'ann-005',
      position: [0.4, -0.5, 0.32],
      crackLevel: CrackLevel.LIGHT,
      recheckStatus: RecheckStatus.VERIFIED,
      photoUrl: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=400&h=300&fit=crop',
      photoOrientation: -60,
      description: '前缘轻微腐蚀痕迹，已记录归档',
      timestamp: baseTime + 1500000,
    },
  ],
  flightPath: Array.from({ length: 60 }, (_, i) => ({
    position: [
      Math.sin(i * 0.2) * 5,
      (i / 60) * 6 - 3,
      Math.cos(i * 0.2) * 5 + 2,
    ] as [number, number, number],
    timestamp: baseTime + i * 30000,
    cameraAngle: [0, -i * 6, 0] as [number, number, number],
  })),
};

export const cameraPresets: CameraPreset[] = [
  {
    id: 'front',
    name: '正视图',
    position: [0, 0, 12],
    target: [0, 0, 0],
  },
  {
    id: 'side',
    name: '侧视图',
    position: [12, 0, 0],
    target: [0, 0, 0],
  },
  {
    id: 'top',
    name: '俯视图',
    position: [0, 12, 0],
    target: [0, 0, 0],
  },
  {
    id: 'isometric',
    name: '等轴视图',
    position: [8, 8, 8],
    target: [0, 0, 0],
  },
  {
    id: 'tip',
    name: '叶尖特写',
    position: [0, 6, 3],
    target: [0, 3, 0],
  },
  {
    id: 'root',
    name: '叶根特写',
    position: [0, -6, 3],
    target: [0, -2, 0],
  },
];
