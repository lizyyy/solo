import type { Floor } from '../types';

export const sampleFloors: Floor[] = [
  {
    id: 'floor_1',
    name: '1F 零售层',
    level: 1,
    zones: [
      {
        id: 'zone_f1_1',
        name: '东北区域',
        floorId: 'floor_1',
        points: [
          { x: 0, y: 0 },
          { x: 50, y: 0 },
          { x: 50, y: 30 },
          { x: 0, y: 30 },
        ],
      },
      {
        id: 'zone_f1_2',
        name: '西北区域',
        floorId: 'floor_1',
        points: [
          { x: 50, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 30 },
          { x: 50, y: 30 },
        ],
      },
      {
        id: 'zone_f1_3',
        name: '东南区域',
        floorId: 'floor_1',
        points: [
          { x: 0, y: 30 },
          { x: 50, y: 30 },
          { x: 50, y: 60 },
          { x: 0, y: 60 },
        ],
      },
      {
        id: 'zone_f1_4',
        name: '西南区域',
        floorId: 'floor_1',
        points: [
          { x: 50, y: 30 },
          { x: 100, y: 30 },
          { x: 100, y: 60 },
          { x: 50, y: 60 },
        ],
      },
    ],
  },
  {
    id: 'floor_2',
    name: '2F 餐饮层',
    level: 2,
    zones: [
      {
        id: 'zone_f2_1',
        name: '美食广场A区',
        floorId: 'floor_2',
        points: [
          { x: 10, y: 5 },
          { x: 40, y: 5 },
          { x: 40, y: 25 },
          { x: 10, y: 25 },
        ],
      },
      {
        id: 'zone_f2_2',
        name: '美食广场B区',
        floorId: 'floor_2',
        points: [
          { x: 60, y: 5 },
          { x: 90, y: 5 },
          { x: 90, y: 25 },
          { x: 60, y: 25 },
        ],
      },
      {
        id: 'zone_f2_3',
        name: '休闲区域',
        floorId: 'floor_2',
        points: [
          { x: 15, y: 35 },
          { x: 85, y: 35 },
          { x: 85, y: 55 },
          { x: 15, y: 55 },
        ],
      },
    ],
  },
  {
    id: 'floor_3',
    name: '3F 办公层',
    level: 3,
    zones: [
      {
        id: 'zone_f3_1',
        name: '开放办公区',
        floorId: 'floor_3',
        points: [
          { x: 5, y: 5 },
          { x: 70, y: 5 },
          { x: 70, y: 40 },
          { x: 5, y: 40 },
        ],
      },
      {
        id: 'zone_f3_2',
        name: '会议室区域',
        floorId: 'floor_3',
        points: [
          { x: 75, y: 5 },
          { x: 95, y: 5 },
          { x: 95, y: 30 },
          { x: 75, y: 30 },
        ],
      },
      {
        id: 'zone_f3_3',
        name: '机房区域',
        floorId: 'floor_3',
        points: [
          { x: 75, y: 35 },
          { x: 95, y: 35 },
          { x: 95, y: 55 },
          { x: 75, y: 55 },
        ],
      },
    ],
  },
];
