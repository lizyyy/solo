import { v4 as uuidv4 } from 'uuid';
import { WallConfig, Route, UserProfile, HoldShape, HoldSize, DifficultyLevel } from '../types';

export const ROUTE_COLORS = [
  '#ef4444',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#f97316',
];

export const HOLD_SHAPES: HoldShape[] = ['jug', 'crimp', 'pocket', 'edge', 'sloper'];

export const HOLD_SIZES: HoldSize[] = ['small', 'medium', 'large'];

export const DIFFICULTY_LEVELS: DifficultyLevel[] = ['beginner', 'intermediate', 'advanced'];

export const DIFFICULTY_NAMES: Record<DifficultyLevel, string> = {
  beginner: '初级',
  intermediate: '中级',
  advanced: '高级',
};

export const SHAPE_NAMES: Record<HoldShape, string> = {
  jug: '大岩点',
  crimp: '小抠点',
  pocket: '孔洞点',
  edge: '条型点',
  sloper: '大斜面',
};

export const SIZE_NAMES: Record<HoldSize, string> = {
  small: '小号',
  medium: '中号',
  large: '大号',
};

export const GRADE_OPTIONS = [
  'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8+',
  '5.8', '5.9', '5.10a', '5.10b', '5.10c', '5.10d',
  '5.11a', '5.11b', '5.11c', '5.11d',
  '5.12a', '5.12b', '5.12c+',
];

export function createSampleWall(): WallConfig {
  return {
    id: uuidv4(),
    name: '示例抱石墙 A',
    width: 400,
    height: 300,
    angle: 5,
    zones: [
      {
        id: uuidv4(),
        name: '高风险区 (顶部)',
        color: 'rgba(239, 68, 68, 0.1)',
        x: 0,
        y: 220,
        width: 400,
        height: 80,
        riskMultiplier: 1.8,
      },
      {
        id: uuidv4(),
        name: '起步区 (底部)',
        color: 'rgba(16, 185, 129, 0.1)',
        x: 0,
        y: 250,
        width: 400,
        height: 50,
        riskMultiplier: 0.8,
      },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function createSampleRoutes(wallId: string): Route[] {
  const now = Date.now();
  
  const route1Id = uuidv4();
  const route2Id = uuidv4();
  const route3Id = uuidv4();

  return [
    {
      id: route1Id,
      wallId,
      name: '新手入门线',
      color: ROUTE_COLORS[2],
      difficulty: 'beginner',
      estimatedGrade: 'V0',
      holds: [
        {
          id: uuidv4(),
          routeId: route1Id,
          shape: 'jug',
          color: ROUTE_COLORS[2],
          size: 'large',
          position: { x: 60, y: 280 },
          rotation: 0,
          isStart: true,
          isEnd: false,
          order: 0,
        },
        {
          id: uuidv4(),
          routeId: route1Id,
          shape: 'jug',
          color: ROUTE_COLORS[2],
          size: 'large',
          position: { x: 150, y: 240 },
          rotation: 0,
          isStart: false,
          isEnd: false,
          order: 1,
        },
        {
          id: uuidv4(),
          routeId: route1Id,
          shape: 'edge',
          color: ROUTE_COLORS[2],
          size: 'medium',
          position: { x: 100, y: 180 },
          rotation: 0,
          isStart: false,
          isEnd: false,
          order: 2,
        },
        {
          id: uuidv4(),
          routeId: route1Id,
          shape: 'jug',
          color: ROUTE_COLORS[2],
          size: 'large',
          position: { x: 180, y: 120 },
          rotation: 0,
          isStart: false,
          isEnd: false,
          order: 3,
        },
        {
          id: uuidv4(),
          routeId: route1Id,
          shape: 'jug',
          color: ROUTE_COLORS[2],
          size: 'large',
          position: { x: 140, y: 60 },
          rotation: 0,
          isStart: false,
          isEnd: true,
          order: 4,
        },
      ],
      createdAt: now,
      updatedAt: now,
      notes: '适合新手练习的简单线路，使用大岩点为主',
    },
    {
      id: route2Id,
      wallId,
      name: '进阶平衡线',
      color: ROUTE_COLORS[3],
      difficulty: 'intermediate',
      estimatedGrade: 'V2',
      holds: [
        {
          id: uuidv4(),
          routeId: route2Id,
          shape: 'edge',
          color: ROUTE_COLORS[3],
          size: 'medium',
          position: { x: 220, y: 280 },
          rotation: 0,
          isStart: true,
          isEnd: false,
          order: 0,
        },
        {
          id: uuidv4(),
          routeId: route2Id,
          shape: 'crimp',
          color: ROUTE_COLORS[3],
          size: 'small',
          position: { x: 280, y: 230 },
          rotation: 0,
          isStart: false,
          isEnd: false,
          order: 1,
        },
        {
          id: uuidv4(),
          routeId: route2Id,
          shape: 'sloper',
          color: ROUTE_COLORS[3],
          size: 'medium',
          position: { x: 320, y: 170 },
          rotation: 0,
          isStart: false,
          isEnd: false,
          order: 2,
        },
        {
          id: uuidv4(),
          routeId: route2Id,
          shape: 'pocket',
          color: ROUTE_COLORS[3],
          size: 'medium',
          position: { x: 260, y: 110 },
          rotation: 0,
          isStart: false,
          isEnd: false,
          order: 3,
        },
        {
          id: uuidv4(),
          routeId: route2Id,
          shape: 'edge',
          color: ROUTE_COLORS[3],
          size: 'medium',
          position: { x: 300, y: 50 },
          rotation: 0,
          isStart: false,
          isEnd: true,
          order: 4,
        },
      ],
      createdAt: now,
      updatedAt: now,
      notes: '需要一定的平衡和核心力量，适合进阶选手',
    },
    {
      id: route3Id,
      wallId,
      name: '动态挑战线',
      color: ROUTE_COLORS[0],
      difficulty: 'advanced',
      estimatedGrade: 'V4',
      holds: [
        {
          id: uuidv4(),
          routeId: route3Id,
          shape: 'crimp',
          color: ROUTE_COLORS[0],
          size: 'small',
          position: { x: 100, y: 280 },
          rotation: 0,
          isStart: true,
          isEnd: false,
          order: 0,
        },
        {
          id: uuidv4(),
          routeId: route3Id,
          shape: 'pocket',
          color: ROUTE_COLORS[0],
          size: 'small',
          position: { x: 200, y: 200 },
          rotation: 0,
          isStart: false,
          isEnd: false,
          order: 1,
        },
        {
          id: uuidv4(),
          routeId: route3Id,
          shape: 'crimp',
          color: ROUTE_COLORS[0],
          size: 'small',
          position: { x: 80, y: 130 },
          rotation: 0,
          isStart: false,
          isEnd: false,
          order: 2,
        },
        {
          id: uuidv4(),
          routeId: route3Id,
          shape: 'sloper',
          color: ROUTE_COLORS[0],
          size: 'medium',
          position: { x: 180, y: 60 },
          rotation: 0,
          isStart: false,
          isEnd: true,
          order: 3,
        },
      ],
      createdAt: now,
      updatedAt: now,
      notes: '需要动态动作，距离跨度较大',
    },
  ];
}

export const DEFAULT_USER_PROFILE: UserProfile = {
  height: 170,
  armSpan: 175,
  skillLevel: 'intermediate',
};

export const HOLD_SIZE_PIXELS: Record<HoldSize, number> = {
  small: 24,
  medium: 36,
  large: 48,
};
