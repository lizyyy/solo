import { Mission } from '@/types';

export const mockMissions: Mission[] = [
  {
    id: 'mission-001',
    name: '飞城区航线训练 - 样例1',
    description: '新人培训航线，包含高楼穿越、禁飞区规避和返航电量演示',
    createdAt: '2024-01-15T10:30:00Z',
    buildings: [
      {
        id: 'bld-001',
        name: '金融中心大厦',
        position: { x: -30, y: 0, z: -20, unit: 'meter' },
        width: 20,
        depth: 20,
        height: 120,
        color: '#4A5568'
      },
      {
        id: 'bld-002',
        name: '科技园区A座',
        position: { x: 30, y: 0, z: -40, unit: 'meter' },
        width: 25,
        depth: 25,
        height: 85,
        color: '#2D3748'
      },
      {
        id: 'bld-003',
        name: '商业综合楼',
        position: { x: -50, y: 0, z: 30, unit: 'meter' },
        width: 30,
        depth: 20,
        height: 65,
        color: '#718096'
      },
      {
        id: 'bld-004',
        name: '住宅楼群1',
        position: { x: 50, y: 0, z: 20, unit: 'meter' },
        width: 15,
        depth: 15,
        height: 55,
        color: '#1A202C'
      },
      {
        id: 'bld-005',
        name: '住宅楼群2',
        position: { x: 65, y: 0, z: 20, unit: 'meter' },
        width: 15,
        depth: 15,
        height: 55,
        color: '#1A202C'
      },
      {
        id: 'bld-006',
        name: '政府大楼',
        position: { x: 0, y: 0, z: 50, unit: 'meter' },
        width: 35,
        depth: 25,
        height: 45,
        color: '#2D3748'
      },
      {
        id: 'bld-007',
        name: '医院大楼',
        position: { x: -60, y: 0, z: -30, unit: 'meter' },
        width: 20,
        depth: 30,
        height: 40,
        color: '#4A5568'
      },
      {
        id: 'bld-008',
        name: '购物中心',
        position: { x: 20, y: 0, z: 60, unit: 'meter' },
        width: 40,
        depth: 30,
        height: 30,
        color: '#2D3748'
      }
    ],
    noFlyZones: [
      {
        id: 'nfz-001',
        name: '机场限制区',
        type: 'polygon',
        coordinates: [
          { x: 10, y: 0, z: -60, unit: 'meter' },
          { x: 60, y: 0, z: -60, unit: 'meter' },
          { x: 60, y: 0, z: -10, unit: 'meter' },
          { x: 10, y: 0, z: -10, unit: 'meter' }
        ],
        minHeight: 0,
        maxHeight: 200,
        color: 'rgba(239, 68, 68, 0.3)'
      },
      {
        id: 'nfz-002',
        name: '政府办公区',
        type: 'circle',
        coordinates: [{ x: 0, y: 0, z: 50, unit: 'meter' }],
        radius: 25,
        minHeight: 0,
        maxHeight: 150,
        color: 'rgba(245, 158, 11, 0.3)'
      }
    ],
    flightPaths: [
      {
        id: 'fp-001',
        name: '主航线',
        color: '#06B6D4',
        waypoints: [
          {
            id: 'wp-001',
            position: { x: -80, y: 50, z: -60, unit: 'meter' },
            speed: 10,
            stayTime: 5
          },
          {
            id: 'wp-002',
            position: { x: -40, y: 80, z: -30, unit: 'meter' },
            speed: 8,
            stayTime: 3
          },
          {
            id: 'wp-003',
            position: { x: 0, y: 100, z: 0, unit: 'meter' },
            speed: 10,
            stayTime: 5
          },
          {
            id: 'wp-004',
            position: { x: 40, y: 70, z: 30, unit: 'meter' },
            speed: 8,
            stayTime: 3
          },
          {
            id: 'wp-005',
            position: { x: 20, y: 50, z: 70, unit: 'meter' },
            speed: 10,
            stayTime: 5
          },
          {
            id: 'wp-006',
            position: { x: -50, y: 40, z: 50, unit: 'meter' },
            speed: 12,
            stayTime: 3
          },
          {
            id: 'wp-007',
            position: { x: -80, y: 60, z: 10, unit: 'meter' },
            speed: 10,
            stayTime: 5
          }
        ]
      }
    ],
    batteryCurve: [
      { time: 0, percentage: 100, distance: 0, altitude: 50 },
      { time: 15, percentage: 92, distance: 150, altitude: 80 },
      { time: 30, percentage: 82, distance: 320, altitude: 100 },
      { time: 45, percentage: 70, distance: 480, altitude: 70 },
      { time: 60, percentage: 58, distance: 620, altitude: 50 },
      { time: 75, percentage: 45, distance: 780, altitude: 40 },
      { time: 90, percentage: 32, distance: 920, altitude: 60 },
      { time: 105, percentage: 20, distance: 1050, altitude: 50 }
    ]
  },
  {
    id: 'mission-002',
    name: '高度单位混练 - 样例2',
    description: '包含英尺和米混用的航点，用于单位转换培训',
    createdAt: '2024-01-16T14:20:00Z',
    buildings: [
      {
        id: 'b2-001',
        name: '高楼A',
        position: { x: -40, y: 0, z: 0, unit: 'meter' },
        width: 20,
        depth: 20,
        height: 150,
        color: '#2D3748'
      },
      {
        id: 'b2-002',
        name: '高楼B',
        position: { x: 40, y: 0, z: 0, unit: 'meter' },
        width: 20,
        depth: 20,
        height: 180,
        color: '#1A202C'
      }
    ],
    noFlyZones: [
      {
        id: 'nfz2-001',
        name: '中央禁飞区',
        type: 'polygon',
        coordinates: [
          { x: -10, y: 0, z: -30, unit: 'meter' },
          { x: 10, y: 0, z: -30, unit: 'meter' },
          { x: 10, y: 0, z: 30, unit: 'meter' },
          { x: -10, y: 0, z: 30, unit: 'meter' }
        ],
        minHeight: 0,
        maxHeight: 200,
        color: 'rgba(239, 68, 68, 0.3)'
      }
    ],
    flightPaths: [
      {
        id: 'fp2-001',
        name: '训练航线',
        color: '#10B981',
        waypoints: [
          {
            id: 'wp2-001',
            position: { x: -70, y: 164, z: -50, unit: 'feet' },
            speed: 10,
            stayTime: 5
          },
          {
            id: 'wp2-002',
            position: { x: -60, y: 60, z: 0, unit: 'meter' },
            speed: 8,
            stayTime: 3
          },
          {
            id: 'wp2-003',
            position: { x: 60, y: 197, z: 0, unit: 'feet' },
            speed: 10,
            stayTime: 5
          },
          {
            id: 'wp2-004',
            position: { x: 70, y: 50, z: 50, unit: 'meter' },
            speed: 8,
            stayTime: 3
          }
        ]
      }
    ],
    batteryCurve: [
      { time: 0, percentage: 100, distance: 0, altitude: 50 },
      { time: 20, percentage: 85, distance: 200, altitude: 60 },
      { time: 40, percentage: 68, distance: 400, altitude: 55 },
      { time: 60, percentage: 50, distance: 600, altitude: 50 }
    ]
  }
];

export const defaultMission = mockMissions[0];
