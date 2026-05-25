import { StationScene } from '../../simulation/types';

export const normalScene: StationScene = {
  id: 'normal',
  name: '正常疏散场景',
  description: '标准地铁站晚高峰客流疏散，3个出口开放，客流有序疏散',
  layout: {
    width: 40,
    height: 30,
    walls: [
      { x: 0, y: 0, width: 40, height: 0.3 },
      { x: 0, y: 29.7, width: 40, height: 0.3 },
      { x: 0, y: 0, width: 0.3, height: 30 },
      { x: 39.7, y: 0, width: 0.3, height: 8 },
      { x: 39.7, y: 11, width: 0.3, height: 8 },
      { x: 39.7, y: 22, width: 0.3, height: 8 },
    ],
    stairs: [
      { id: 'stair-1', x: 20, y: 7, width: 4, height: 2, direction: 'up', capacity: 50 },
      { id: 'stair-2', x: 20, y: 23, width: 4, height: 2, direction: 'down', capacity: 50 }
    ],
    gates: [
      { id: 'gate-1', x: 36, y: 9.5, type: 'exit', status: 'open', speed: 1 },
      { id: 'gate-2', x: 36, y: 15, type: 'exit', status: 'open', speed: 1 },
      { id: 'gate-3', x: 36, y: 20.5, type: 'exit', status: 'open', speed: 1 },
      { id: 'gate-4', x: 4, y: 15, type: 'entry', status: 'open', speed: 1 }
    ],
    exits: [
      { id: 'exit-1', x: 39.5, y: 9.5, width: 2, name: 'A出口' },
      { id: 'exit-2', x: 39.5, y: 15, width: 2, name: 'B出口' },
      { id: 'exit-3', x: 39.5, y: 20.5, width: 2, name: 'C出口' }
    ],
    platforms: []
  },
  passengerBatches: [
    { id: 'batch-1', startTime: 0, count: 40, spawnX: 20, spawnY: 15, speed: 1.5 },
    { id: 'batch-2', startTime: 5, count: 30, spawnX: 8, spawnY: 8, speed: 1.3 },
    { id: 'batch-3', startTime: 10, count: 30, spawnX: 8, spawnY: 22, speed: 1.4 }
  ],
  closedAreas: []
};
