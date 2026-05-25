import { StationScene } from '../../simulation/types';

export const conflictScene: StationScene = {
  id: 'conflict',
  name: '冲突场景',
  description: '主出口临时关闭，双向人流在楼梯处冲突，形成严重瓶颈',
  layout: {
    width: 40,
    height: 30,
    walls: [
      { x: 0, y: 0, width: 40, height: 0.5 },
      { x: 0, y: 29.5, width: 40, height: 0.5 },
      { x: 0, y: 0, width: 0.5, height: 30 },
      { x: 39.5, y: 0, width: 0.5, height: 30 },
      { x: 15, y: 8, width: 5, height: 0.5 },
      { x: 25, y: 8, width: 5, height: 0.5 },
      { x: 15, y: 21.5, width: 5, height: 0.5 },
      { x: 25, y: 21.5, width: 5, height: 0.5 },
      { x: 15, y: 8, width: 0.5, height: 5 },
      { x: 15, y: 17, width: 0.5, height: 5 },
      { x: 24.5, y: 8, width: 0.5, height: 5 },
      { x: 24.5, y: 17, width: 0.5, height: 5 },
    ],
    stairs: [
      { id: 'stair-1', x: 20, y: 5, width: 3, height: 3, direction: 'up', capacity: 20 },
      { id: 'stair-2', x: 20, y: 25, width: 3, height: 3, direction: 'down', capacity: 20 }
    ],
    gates: [
      { id: 'gate-1', x: 32, y: 10, type: 'exit', status: 'closed', speed: 1 },
      { id: 'gate-2', x: 32, y: 15, type: 'exit', status: 'open', speed: 0.5 },
      { id: 'gate-3', x: 32, y: 20, type: 'exit', status: 'closed', speed: 1 },
      { id: 'gate-4', x: 8, y: 15, type: 'entry', status: 'closed', speed: 1 }
    ],
    exits: [
      { id: 'exit-1', x: 35, y: 15, width: 2, name: '唯一开放出口' }
    ],
    platforms: [
      { x: 16, y: 9, width: 7.5, height: 12 }
    ]
  },
  passengerBatches: [
    { id: 'batch-1', startTime: 0, count: 80, spawnX: 20, spawnY: 15, speed: 1.5 },
    { id: 'batch-2', startTime: 5, count: 60, spawnX: 10, spawnY: 5, speed: 1.2 },
    { id: 'batch-3', startTime: 8, count: 60, spawnX: 10, spawnY: 25, speed: 1.3 }
  ],
  closedAreas: [
    { id: 'closed-1', x: 28, y: 8, width: 2, height: 4, reason: '设备维护区域' },
    { id: 'closed-2', x: 28, y: 18, width: 2, height: 4, reason: '设备维护区域' }
  ]
};
