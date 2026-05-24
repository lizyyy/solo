import { StationScene } from '../../simulation/types';

export const emptyScene: StationScene = {
  id: 'empty',
  name: '空结果场景',
  description: '非高峰时段，客流稀少，无瓶颈，快速疏散',
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
      { id: 'stair-1', x: 20, y: 5, width: 5, height: 3, direction: 'up', capacity: 100 },
      { id: 'stair-2', x: 20, y: 25, width: 5, height: 3, direction: 'down', capacity: 100 }
    ],
    gates: [
      { id: 'gate-1', x: 32, y: 8, type: 'exit', status: 'open', speed: 2 },
      { id: 'gate-2', x: 32, y: 13, type: 'exit', status: 'open', speed: 2 },
      { id: 'gate-3', x: 32, y: 18, type: 'exit', status: 'open', speed: 2 },
      { id: 'gate-4', x: 32, y: 23, type: 'exit', status: 'open', speed: 2 },
      { id: 'gate-5', x: 8, y: 15, type: 'entry', status: 'open', speed: 2 }
    ],
    exits: [
      { id: 'exit-1', x: 38, y: 8, width: 2, name: 'A出口' },
      { id: 'exit-2', x: 38, y: 13, width: 2, name: 'B出口' },
      { id: 'exit-3', x: 38, y: 18, width: 2, name: 'C出口' },
      { id: 'exit-4', x: 38, y: 23, width: 2, name: 'D出口' }
    ],
    platforms: [
      { x: 16, y: 9, width: 7.5, height: 12 }
    ]
  },
  passengerBatches: [
    { id: 'batch-1', startTime: 0, count: 10, spawnX: 20, spawnY: 15, speed: 2 },
    { id: 'batch-2', startTime: 15, count: 8, spawnX: 10, spawnY: 5, speed: 2 }
  ],
  closedAreas: []
};
