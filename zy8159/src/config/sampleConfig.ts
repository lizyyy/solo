import { GameConfig, CellType } from '../types';

const FLOOR: CellType = 'floor';
const WALL: CellType = 'wall';
const EXIT: CellType = 'exit';
const CASE: CellType = 'case';

export const sampleMapGrid: CellType[][] = [
  [WALL, WALL, WALL, WALL, WALL, WALL, WALL, WALL, WALL, WALL, WALL, WALL],
  [WALL, FLOOR, FLOOR, FLOOR, FLOOR, FLOOR, FLOOR, FLOOR, FLOOR, FLOOR, FLOOR, WALL],
  [WALL, FLOOR, CASE, FLOOR, FLOOR, WALL, FLOOR, FLOOR, CASE, FLOOR, FLOOR, WALL],
  [WALL, FLOOR, FLOOR, FLOOR, FLOOR, WALL, FLOOR, FLOOR, FLOOR, FLOOR, FLOOR, WALL],
  [WALL, FLOOR, FLOOR, FLOOR, FLOOR, FLOOR, FLOOR, FLOOR, FLOOR, FLOOR, FLOOR, WALL],
  [WALL, WALL, WALL, FLOOR, FLOOR, WALL, WALL, FLOOR, FLOOR, WALL, WALL, WALL],
  [WALL, FLOOR, FLOOR, FLOOR, FLOOR, WALL, FLOOR, FLOOR, FLOOR, FLOOR, FLOOR, WALL],
  [WALL, FLOOR, CASE, FLOOR, FLOOR, FLOOR, FLOOR, FLOOR, FLOOR, CASE, FLOOR, WALL],
  [WALL, FLOOR, FLOOR, FLOOR, FLOOR, WALL, FLOOR, FLOOR, FLOOR, FLOOR, FLOOR, WALL],
  [WALL, FLOOR, FLOOR, FLOOR, FLOOR, WALL, FLOOR, FLOOR, FLOOR, FLOOR, EXIT, WALL],
  [WALL, FLOOR, FLOOR, FLOOR, FLOOR, WALL, FLOOR, FLOOR, FLOOR, FLOOR, FLOOR, WALL],
  [WALL, WALL, WALL, WALL, WALL, WALL, WALL, WALL, WALL, WALL, WALL, WALL]
];

export const sampleConfig: GameConfig = {
  map: {
    width: 12,
    height: 12,
    grid: sampleMapGrid,
    exitPositions: [
      { x: 10, y: 9 }
    ]
  },
  artifacts: [
    {
      id: 'art_001',
      name: '埃及法老黄金面具',
      value: 1000000,
      weight: 3,
      caseId: 'case_001',
      isCollected: false,
      isSecured: false
    },
    {
      id: 'art_002',
      name: '达芬奇素描手稿',
      value: 800000,
      weight: 1,
      caseId: 'case_002',
      isCollected: false,
      isSecured: false
    },
    {
      id: 'art_003',
      name: '中国青花瓷瓶',
      value: 600000,
      weight: 2,
      caseId: 'case_003',
      isCollected: false,
      isSecured: false
    },
    {
      id: 'art_004',
      name: '罗马帝国金币',
      value: 400000,
      weight: 1,
      caseId: 'case_004',
      isCollected: false,
      isSecured: false
    },
    {
      id: 'art_005',
      name: '文艺复兴油画',
      value: 1200000,
      weight: 4,
      caseId: 'case_005',
      isCollected: false,
      isSecured: false
    }
  ],
  displayCases: [
    {
      id: 'case_001',
      position: { x: 2, y: 2 },
      isLocked: true,
      unlockTurns: 1,
      artifactId: 'art_001'
    },
    {
      id: 'case_002',
      position: { x: 8, y: 2 },
      isLocked: true,
      unlockTurns: 1,
      artifactId: 'art_002'
    },
    {
      id: 'case_003',
      position: { x: 2, y: 7 },
      isLocked: true,
      unlockTurns: 1,
      artifactId: 'art_003'
    },
    {
      id: 'case_004',
      position: { x: 9, y: 7 },
      isLocked: true,
      unlockTurns: 1,
      artifactId: 'art_004'
    },
    {
      id: 'case_005',
      position: { x: 5, y: 4 },
      isLocked: true,
      unlockTurns: 1,
      artifactId: 'art_005'
    }
  ],
  custodians: [
    {
      id: 'cust_001',
      name: '老王',
      position: { x: 1, y: 1 },
      maxLoad: 5,
      currentLoad: 0,
      carriedArtifacts: [],
      canMove: true,
      isSelected: false
    },
    {
      id: 'cust_002',
      name: '小张',
      position: { x: 10, y: 1 },
      maxLoad: 4,
      currentLoad: 0,
      carriedArtifacts: [],
      canMove: true,
      isSelected: false
    }
  ],
  guards: [
    {
      id: 'guard_001',
      name: '安保-李队',
      position: { x: 4, y: 4 },
      patrolRoute: [
        { x: 4, y: 4 },
        { x: 4, y: 3 },
        { x: 4, y: 2 },
        { x: 4, y: 3 },
        { x: 4, y: 4 },
        { x: 4, y: 5 },
        { x: 4, y: 6 },
        { x: 4, y: 7 },
        { x: 4, y: 6 },
        { x: 4, y: 5 }
      ],
      currentRouteIndex: 0,
      viewRange: 3,
      direction: 'down'
    },
    {
      id: 'guard_002',
      name: '安保-王哥',
      position: { x: 7, y: 6 },
      patrolRoute: [
        { x: 7, y: 6 },
        { x: 6, y: 6 },
        { x: 5, y: 6 },
        { x: 4, y: 6 },
        { x: 3, y: 6 },
        { x: 2, y: 6 },
        { x: 1, y: 6 },
        { x: 2, y: 6 },
        { x: 3, y: 6 },
        { x: 4, y: 6 },
        { x: 5, y: 6 },
        { x: 6, y: 6 }
      ],
      currentRouteIndex: 0,
      viewRange: 2,
      direction: 'left'
    }
  ],
  eventCards: [
    {
      id: 'power_outage',
      name: '电力故障',
      description: '博物馆突然停电！安保人员视野范围减半，但移动不受影响。',
      type: 'negative',
      triggerTurns: [5, 12],
      duration: 2,
      isActive: false,
      turnsRemaining: 0
    },
    {
      id: 'security_alert',
      name: '安保警觉',
      description: '安保人员收到可疑报告，视野范围暂时增加1格。',
      type: 'negative',
      triggerTurns: [8],
      duration: 2,
      isActive: false,
      turnsRemaining: 0
    },
    {
      id: 'case_malfunction',
      name: '展柜故障',
      description: '一个展柜的电子锁出现故障，自动解锁。',
      type: 'positive',
      triggerTurns: [3],
      duration: 0,
      isActive: false,
      turnsRemaining: 0
    }
  ],
  maxTurns: 20,
  totalArtifactsToSecure: 5
};

export const sampleConfigJSON = JSON.stringify(sampleConfig, null, 2);
