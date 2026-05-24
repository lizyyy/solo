import { StationScene } from '../../simulation/types';

export const normalScene: StationScene = {
  id: 'normal',
  name: '正常疏散场景',
  description: '标准地铁站晚高峰客流疏散，所有出口开放，客流有序疏散',
  layout: {
    width: 40,
    height: 30,
    walls: [
      { x: 0, y: 0, width: 40, height: 0.5 },
      { x: 0, y: 29.5, width: 40, height: 0.5 },
      { x: 0, y: 0, width: 0.5, height: 30 },
      { x: 39.5, y: 0, width: 0.5, height: 30 },
      { x: 15, y: 8, width: 10, height: 0.5 },
      { x: 15, y: 21.5, width: 10, height: 0.5 },
      { x: 15, y: 8, width: 0.5, height: 14 },
      { x: 24.5, y: 8, width: 0.5, height: 14 },
    ],
    stairs: [
      { id: 'stair-1', x: 20, y: 5, width: 4, height: 3, direction: 'up', capacity: 50 },
      { id: 'stair-2', x: 20, y: 25, width: 4, height: 3, direction: 'down', capacity: 50 }
    ],
    gates: [
      { id: 'gate-1', x: 32, y: 10, type: 'exit', status: 'open', speed: 1 },
      { id: 'gate-2', x: 32, y: 15, type: 'exit', status: 'open', speed: 1 },
      { id: 'gate-3', x: 32, y: 20, type: 'exit', status: 'open', speed: 1 },
      { id: 'gate-4', x: 8, y: 15, type: 'entry', status: 'open', speed: 1 }
    ],
    exits: [
      { id: 'exit-1', x: 38, y: 10, width: 2, name: 'A出口' },
      { id: 'exit-2', x: 38, y: 20, width: 2, name: 'B出口' }
    ],
    platforms: [
      { x: 16, y: 9, width: 7.5, height: 12 }
    ]
  },
  passengerBatches: [
    { id: 'batch-1', startTime: 0, count: 50, spawnX: 20, spawnY: 15, speed: 1.5 },
    { id: 'batch-2', startTime: 10, count: 30, spawnX: 10, spawnY: 5, speed: 1.2 },
    { id: 'batch-3', startTime: 20, count: 40, spawnX: 10, spawnY: 25, speed: 1.3 }
  ],
  closedAreas: []
};
