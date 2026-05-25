import { StationScene } from '../../simulation/types';

export const emptyScene: StationScene = {
  id: 'empty',
  name: '空结果场景',
  description: '非高峰时段，客流稀少，4个出口全部开放，无瓶颈快速疏散',
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
      { id: 'stair-1', x: 20, y: 7, width: 5, height: 2, direction: 'up', capacity: 100 },
      { id: 'stair-2', x: 20, y: 23, width: 5, height: 2, direction: 'down', capacity: 100 }
    ],
    gates: [
      { id: 'gate-1', x: 36, y: 7, type: 'exit', status: 'open', speed: 2 },
      { id: 'gate-2', x: 36, y: 13, type: 'exit', status: 'open', speed: 2 },
      { id: 'gate-3', x: 36, y: 17, type: 'exit', status: 'open', speed: 2 },
      { id: 'gate-4', x: 36, y: 23, type: 'exit', status: 'open', speed: 2 },
      { id: 'gate-5', x: 4, y: 15, type: 'entry', status: 'open', speed: 2 }
    ],
    exits: [
      { id: 'exit-1', x: 39.5, y: 7, width: 2, name: 'A出口' },
      { id: 'exit-2', x: 39.5, y: 13, width: 2, name: 'B出口' },
      { id: 'exit-3', x: 39.5, y: 17, width: 2, name: 'C出口' },
      { id: 'exit-4', x: 39.5, y: 23, width: 2, name: 'D出口' }
    ],
    platforms: []
  },
  passengerBatches: [
    { id: 'batch-1', startTime: 0, count: 10, spawnX: 20, spawnY: 15, speed: 2.5 },
    { id: 'batch-2', startTime: 8, count: 8, spawnX: 8, spawnY: 8, speed: 2.5 }
  ],
  closedAreas: []
};
