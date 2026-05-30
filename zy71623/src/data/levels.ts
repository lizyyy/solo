import { Level, PolygonBlock } from '../types';
import { calculateArea } from '../engine/geometry';

const createTriangle = (size: number): { x: number; y: number }[] => {
  return [
    { x: 0, y: -size / 2 },
    { x: size / 2, y: size / 2 },
    { x: -size / 2, y: size / 2 }
  ];
};

const createRectangle = (width: number, height: number): { x: number; y: number }[] => {
  return [
    { x: -width / 2, y: -height / 2 },
    { x: width / 2, y: -height / 2 },
    { x: width / 2, y: height / 2 },
    { x: -width / 2, y: height / 2 }
  ];
};

const createTrapezoid = (topWidth: number, bottomWidth: number, height: number): { x: number; y: number }[] => {
  return [
    { x: -topWidth / 2, y: -height / 2 },
    { x: topWidth / 2, y: -height / 2 },
    { x: bottomWidth / 2, y: height / 2 },
    { x: -bottomWidth / 2, y: height / 2 }
  ];
};

const createDiamond = (size: number): { x: number; y: number }[] => {
  return [
    { x: 0, y: -size / 2 },
    { x: size / 2, y: 0 },
    { x: 0, y: size / 2 },
    { x: -size / 2, y: 0 }
  ];
};

const createPolygonBlock = (
  id: string,
  name: string,
  vertices: { x: number; y: number }[],
  color: string,
  strength: number = 100
): PolygonBlock => {
  return {
    id,
    name,
    vertices,
    area: calculateArea(vertices),
    weight: calculateArea(vertices) * 0.1,
    strength,
    color
  };
};

export const baseBlocks: PolygonBlock[] = [
  createPolygonBlock('tri-small', '小三角形', createTriangle(40), '#4ade80', 120),
  createPolygonBlock('tri-medium', '中三角形', createTriangle(60), '#22c55e', 100),
  createPolygonBlock('tri-large', '大三角形', createTriangle(80), '#16a34a', 80),
  createPolygonBlock('rect-small', '小矩形', createRectangle(40, 25), '#60a5fa', 110),
  createPolygonBlock('rect-medium', '中矩形', createRectangle(60, 30), '#3b82f6', 90),
  createPolygonBlock('rect-large', '大矩形', createRectangle(80, 35), '#2563eb', 70),
  createPolygonBlock('trap-small', '小梯形', createTrapezoid(30, 50, 25), '#f472b6', 95),
  createPolygonBlock('trap-medium', '中梯形', createTrapezoid(45, 70, 35), '#ec4899', 85),
  createPolygonBlock('diamond', '菱形', createDiamond(50), '#a78bfa', 75)
];

export const levels: Level[] = [
  {
    id: 'level-1',
    name: '入门教程：简单平桥',
    description: '学习基础操作，用矩形搭建第一座桥。注意面积预算限制！',
    difficulty: 'easy',
    areaBudget: 3000,
    requiredStrength: 50,
    bridgeWidth: 400,
    bridgeHeight: 150,
    startPoint: { x: 100, y: 300 },
    endPoint: { x: 500, y: 300 },
    piers: [
      { id: 'pier-1', position: { x: 100, y: 350 }, height: 100, width: 40 },
      { id: 'pier-2', position: { x: 500, y: 350 }, height: 100, width: 40 }
    ],
    availableBlocks: baseBlocks.slice(3, 6),
    truck: {
      id: 'truck-1',
      weight: 80,
      position: { x: 100, y: 280 },
      speed: 2
    }
  },
  {
    id: 'level-2',
    name: '进阶挑战：三角桁架',
    description: '三角形结构更稳定！尝试用三角形构建桁架桥。',
    difficulty: 'medium',
    areaBudget: 4000,
    requiredStrength: 70,
    bridgeWidth: 450,
    bridgeHeight: 180,
    startPoint: { x: 80, y: 280 },
    endPoint: { x: 530, y: 280 },
    piers: [
      { id: 'pier-1', position: { x: 80, y: 350 }, height: 100, width: 40 },
      { id: 'pier-2', position: { x: 305, y: 350 }, height: 80, width: 30 },
      { id: 'pier-3', position: { x: 530, y: 350 }, height: 100, width: 40 }
    ],
    availableBlocks: [...baseBlocks.slice(0, 3), ...baseBlocks.slice(3, 5)],
    truck: {
      id: 'truck-2',
      weight: 120,
      position: { x: 80, y: 260 },
      speed: 1.8
    }
  },
  {
    id: 'level-3',
    name: '高级挑战：单墩大跨度',
    description: '只有中间一个桥墩，考验你的结构设计能力！',
    difficulty: 'hard',
    areaBudget: 5500,
    requiredStrength: 90,
    bridgeWidth: 500,
    bridgeHeight: 200,
    startPoint: { x: 50, y: 260 },
    endPoint: { x: 550, y: 260 },
    piers: [
      { id: 'pier-1', position: { x: 300, y: 350 }, height: 120, width: 50 }
    ],
    availableBlocks: baseBlocks,
    truck: {
      id: 'truck-3',
      weight: 150,
      position: { x: 50, y: 240 },
      speed: 1.5
    }
  }
];

export const sampleData = {
  correctSolution: {
    levelId: 'level-1',
    description: '正确示例：连续矩形桥面',
    placedPolygons: [
      { blockId: 'rect-medium', position: { x: 160, y: 300 }, rotation: 0 },
      { blockId: 'rect-medium', position: { x: 240, y: 300 }, rotation: 0 },
      { blockId: 'rect-medium', position: { x: 320, y: 300 }, rotation: 0 },
      { blockId: 'rect-medium', position: { x: 400, y: 300 }, rotation: 0 },
      { blockId: 'rect-small', position: { x: 460, y: 300 }, rotation: 0 }
    ],
    expectedResult: 'pass',
    usedArea: 6 * 30 * 60 + 40 * 25
  },
  areaExceeded: {
    levelId: 'level-1',
    description: '错误示例：面积超限',
    placedPolygons: [
      { blockId: 'rect-large', position: { x: 150, y: 300 }, rotation: 0 },
      { blockId: 'rect-large', position: { x: 250, y: 300 }, rotation: 0 },
      { blockId: 'rect-large', position: { x: 350, y: 300 }, rotation: 0 },
      { blockId: 'rect-large', position: { x: 450, y: 300 }, rotation: 0 },
      { blockId: 'tri-large', position: { x: 300, y: 200 }, rotation: 0 }
    ],
    expectedResult: 'fail',
    errorType: 'area_exceeded'
  },
  notConnected: {
    levelId: 'level-1',
    description: '错误示例：桥梁断开',
    placedPolygons: [
      { blockId: 'rect-medium', position: { x: 160, y: 300 }, rotation: 0 },
      { blockId: 'rect-medium', position: { x: 240, y: 300 }, rotation: 0 },
      { blockId: 'rect-medium', position: { x: 400, y: 300 }, rotation: 0 },
      { blockId: 'rect-medium', position: { x: 480, y: 300 }, rotation: 0 }
    ],
    expectedResult: 'fail',
    errorType: 'not_connected'
  },
  overlap: {
    levelId: 'level-1',
    description: '错误示例：多边形重叠',
    placedPolygons: [
      { blockId: 'rect-medium', position: { x: 200, y: 300 }, rotation: 0 },
      { blockId: 'rect-medium', position: { x: 250, y: 300 }, rotation: 0 },
      { blockId: 'rect-medium', position: { x: 350, y: 300 }, rotation: 0 },
      { blockId: 'rect-medium', position: { x: 400, y: 300 }, rotation: 0 }
    ],
    expectedResult: 'fail',
    errorType: 'overlap'
  },
  weakStructure: {
    levelId: 'level-3',
    description: '错误示例：结构过弱',
    placedPolygons: [
      { blockId: 'rect-large', position: { x: 180, y: 280 }, rotation: 0 },
      { blockId: 'rect-large', position: { x: 420, y: 280 }, rotation: 0 }
    ],
    expectedResult: 'fail',
    errorType: 'structural_failure'
  }
};

export default levels;
