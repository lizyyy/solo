import { StationScene } from '../../simulation/types';

export const conflictScene: StationScene = {
  id: 'conflict',
  name: '冲突场景',
  description: '两侧出口关闭，仅中间出口开放，形成严重瓶颈',
  layout: {
    width: 40,
    height: 30,
    walls: [
      { x: 0, y: 0, width: 40, height: 0.3 },
      { x: 0, y: 29.7, width: 40, height: 0.3 },
      { x: 0, y: 0, width: 0.3, height: 30 },
      { x: 39.7, y: 0, width: 0.3, height: 30 },
    ],
    stairs: [
      { id: 'stair-1', x: 20, y: 7, width: 3, height: 2, direction: 'up', capacity: 20 },
      { id: 'stair-2', x: 20, y: 23, width: 3, height: 2, direction: 'down', capacity: 20 }
    ],
    gates: [
      { id: 'gate-1', x: 36, y: 15, type: 'exit', status: 'open', speed: 0.5 },
      { id: 'gate-2', x: 4, y: 15, type: 'entry', status: 'closed', speed: 1 }
    ],
    exits: [
      { id: 'exit-1', x: 39.5, y: 15, width: 2, name: '唯一开放出口' }
    ],
    platforms: []
  },
  passengerBatches: [
    { id: 'batch-1', startTime: 0, count: 70, spawnX: 20, spawnY: 15, speed: 1.5 },
    { id: 'batch-2', startTime: 3, count: 65, spawnX: 10, spawnY: 8, speed: 1.3 },
    { id: 'batch-3', startTime: 6, count: 65, spawnX: 10, spawnY: 22, speed: 1.4 }
  ],
  closedAreas: [
    { id: 'closed-1', x: 30, y: 5, width: 3, height: 5, reason: '设备维护区' },
    { id: 'closed-2', x: 30, y: 20, width: 3, height: 5, reason: '设备维护区' }
  ]
};
