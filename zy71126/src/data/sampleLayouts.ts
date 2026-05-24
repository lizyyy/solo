import { ClassroomLayout } from '@/types';

const createSeats = (rows: number, cols: number, startX: number, startZ: number, spacingX: number, spacingZ: number) => {
  const seats = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      seats.push({
        id: `seat-${row}-${col}`,
        row,
        col,
        position: {
          x: startX + col * spacingX,
          y: 0,
          z: startZ + row * spacingZ,
        },
        isBlocked: false,
        isSelected: false,
        isVisible: true,
      });
    }
  }
  return seats;
};

export const sampleLayouts: ClassroomLayout[] = [
  {
    name: '标准教室 - 无遮挡',
    eyeHeight: 1.2,
    platform: {
      position: { x: 0, y: 0, z: -8 },
      size: { width: 6, height: 0.3, depth: 2 },
      targetPoint: { x: 0, y: 1.5, z: -7 },
    },
    seats: createSeats(6, 8, -8.75, 0, 2.5, 2),
    obstacles: [],
  },
  {
    name: '标准教室 - 中间柱子',
    eyeHeight: 1.2,
    platform: {
      position: { x: 0, y: 0, z: -8 },
      size: { width: 6, height: 0.3, depth: 2 },
      targetPoint: { x: 0, y: 1.5, z: -7 },
    },
    seats: createSeats(6, 8, -8.75, 0, 2.5, 2),
    obstacles: [
      {
        id: 'pillar-1',
        type: 'pillar',
        position: { x: 0, y: 1.5, z: 2 },
        size: { width: 0.5, height: 3, depth: 0.5 },
      },
      {
        id: 'pillar-2',
        type: 'pillar',
        position: { x: -3, y: 1.5, z: 4 },
        size: { width: 0.5, height: 3, depth: 0.5 },
      },
    ],
  },
  {
    name: '大型教室 - 多柱子+投影架',
    eyeHeight: 1.2,
    platform: {
      position: { x: 0, y: 0, z: -10 },
      size: { width: 8, height: 0.3, depth: 2 },
      targetPoint: { x: 0, y: 1.5, z: -9 },
    },
    seats: createSeats(8, 10, -11.25, 0, 2.5, 2),
    obstacles: [
      {
        id: 'pillar-1',
        type: 'pillar',
        position: { x: -5, y: 1.5, z: 2 },
        size: { width: 0.6, height: 3.5, depth: 0.6 },
      },
      {
        id: 'pillar-2',
        type: 'pillar',
        position: { x: 0, y: 1.5, z: 2 },
        size: { width: 0.6, height: 3.5, depth: 0.6 },
      },
      {
        id: 'pillar-3',
        type: 'pillar',
        position: { x: 5, y: 1.5, z: 2 },
        size: { width: 0.6, height: 3.5, depth: 0.6 },
      },
      {
        id: 'projector-1',
        type: 'projector',
        position: { x: 0, y: 3, z: -3 },
        size: { width: 1.5, height: 0.3, depth: 0.5 },
      },
      {
        id: 'screen-1',
        type: 'screen',
        position: { x: 0, y: 2, z: -9.5 },
        size: { width: 4, height: 2.5, depth: 0.1 },
      },
    ],
  },
  {
    name: '小型培训室',
    eyeHeight: 1.1,
    platform: {
      position: { x: 0, y: 0, z: -6 },
      size: { width: 4, height: 0.3, depth: 1.5 },
      targetPoint: { x: 0, y: 1.4, z: -5 },
    },
    seats: createSeats(4, 6, -6.25, 0, 2.5, 2),
    obstacles: [
      {
        id: 'pillar-1',
        type: 'pillar',
        position: { x: -4, y: 1.5, z: 1 },
        size: { width: 0.4, height: 2.8, depth: 0.4 },
      },
    ],
  },
];

export const defaultLayout = sampleLayouts[1];
