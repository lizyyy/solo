import type { BuildingModel } from '../types';

export const officeBuilding: BuildingModel = {
  id: 'office-001',
  name: '3层办公楼',
  floors: 3,
  floorHeight: 4,
  groundSize: { width: 40, depth: 30 },
  walls: [
    { id: 'w1', start: { x: -20, y: 0, z: -15 }, end: { x: 20, y: 0, z: -15 }, height: 12 },
    { id: 'w2', start: { x: 20, y: 0, z: -15 }, end: { x: 20, y: 0, z: 15 }, height: 12 },
    { id: 'w3', start: { x: 20, y: 0, z: 15 }, end: { x: -20, y: 0, z: 15 }, height: 12 },
    { id: 'w4', start: { x: -20, y: 0, z: 15 }, end: { x: -20, y: 0, z: -15 }, height: 12 },
    { id: 'w5', start: { x: -5, y: 0, z: -15 }, end: { x: -5, y: 0, z: 0 }, height: 12 },
    { id: 'w6', start: { x: 10, y: 0, z: -15 }, end: { x: 10, y: 0, z: 5 }, height: 12 },
    { id: 'w7', start: { x: -20, y: 0, z: -5 }, end: { x: -5, y: 0, z: -5 }, height: 12 },
    { id: 'w8', start: { x: -5, y: 0, z: 5 }, end: { x: 10, y: 0, z: 5 }, height: 12 },
  ],
  hydrants: [
    { id: 'h1', position: { x: -15, y: 0.5, z: -12 }, name: '一层西侧消火栓', pressure: 0.6 },
    { id: 'h2', position: { x: 15, y: 0.5, z: -10 }, name: '一层东侧消火栓', pressure: 0.6 },
    { id: 'h3', position: { x: 0, y: 4.5, z: -12 }, name: '二层北侧消火栓', pressure: 0.55 },
    { id: 'h4', position: { x: -10, y: 4.5, z: 10 }, name: '二层西侧消火栓', pressure: 0.55 },
    { id: 'h5', position: { x: 10, y: 8.5, z: 0 }, name: '三层东侧消火栓', pressure: 0.5 },
    { id: 'h6', position: { x: -12, y: 8.5, z: -5 }, name: '三层西北消火栓', pressure: 0.5 },
  ],
  staircases: [
    {
      id: 's1',
      startPoint: { x: 5, y: 0, z: 10 },
      endPoint: { x: 5, y: 12, z: 10 },
      floors: 3,
    },
    {
      id: 's2',
      startPoint: { x: -15, y: 0, z: 0 },
      endPoint: { x: -15, y: 12, z: 0 },
      floors: 3,
    },
  ],
};

export const residentialBuilding: BuildingModel = {
  id: 'residential-001',
  name: '5层住宅楼',
  floors: 5,
  floorHeight: 3,
  groundSize: { width: 30, depth: 20 },
  walls: [
    { id: 'rw1', start: { x: -15, y: 0, z: -10 }, end: { x: 15, y: 0, z: -10 }, height: 15 },
    { id: 'rw2', start: { x: 15, y: 0, z: -10 }, end: { x: 15, y: 0, z: 10 }, height: 15 },
    { id: 'rw3', start: { x: 15, y: 0, z: 10 }, end: { x: -15, y: 0, z: 10 }, height: 15 },
    { id: 'rw4', start: { x: -15, y: 0, z: 10 }, end: { x: -15, y: 0, z: -10 }, height: 15 },
    { id: 'rw5', start: { x: 0, y: 0, z: -10 }, end: { x: 0, y: 0, z: 5 }, height: 15 },
    { id: 'rw6', start: { x: -10, y: 0, z: -5 }, end: { x: -10, y: 0, z: 10 }, height: 15 },
    { id: 'rw7', start: { x: 10, y: 0, z: -5 }, end: { x: 10, y: 0, z: 10 }, height: 15 },
  ],
  hydrants: [
    { id: 'rh1', position: { x: -12, y: 0.5, z: -7 }, name: '1层西北消火栓', pressure: 0.65 },
    { id: 'rh2', position: { x: 12, y: 0.5, z: -7 }, name: '1层东北消火栓', pressure: 0.65 },
    { id: 'rh3', position: { x: -5, y: 3.5, z: -8 }, name: '2层西消火栓', pressure: 0.6 },
    { id: 'rh4', position: { x: 5, y: 6.5, z: -8 }, name: '3层东消火栓', pressure: 0.55 },
    { id: 'rh5', position: { x: -5, y: 9.5, z: 7 }, name: '4层西消火栓', pressure: 0.5 },
    { id: 'rh6', position: { x: 5, y: 12.5, z: 7 }, name: '5层东消火栓', pressure: 0.45 },
  ],
  staircases: [
    {
      id: 'rs1',
      startPoint: { x: 0, y: 0, z: 7 },
      endPoint: { x: 0, y: 15, z: 7 },
      floors: 5,
    },
  ],
};

export const warehouseBuilding: BuildingModel = {
  id: 'warehouse-001',
  name: '大型仓库',
  floors: 1,
  floorHeight: 8,
  groundSize: { width: 60, depth: 40 },
  walls: [
    { id: 'ww1', start: { x: -30, y: 0, z: -20 }, end: { x: 30, y: 0, z: -20 }, height: 8 },
    { id: 'ww2', start: { x: 30, y: 0, z: -20 }, end: { x: 30, y: 0, z: 20 }, height: 8 },
    { id: 'ww3', start: { x: 30, y: 0, z: 20 }, end: { x: -30, y: 0, z: 20 }, height: 8 },
    { id: 'ww4', start: { x: -30, y: 0, z: 20 }, end: { x: -30, y: 0, z: -20 }, height: 8 },
    { id: 'ww5', start: { x: 0, y: 0, z: -20 }, end: { x: 0, y: 0, z: 0 }, height: 6 },
    { id: 'ww6', start: { x: -20, y: 0, z: 0 }, end: { x: 20, y: 0, z: 0 }, height: 6 },
    { id: 'ww7', start: { x: -10, y: 0, z: 10 }, end: { x: 10, y: 0, z: 10 }, height: 4 },
  ],
  hydrants: [
    { id: 'wh1', position: { x: -25, y: 0.5, z: -15 }, name: '西南消火栓', pressure: 0.7 },
    { id: 'wh2', position: { x: 25, y: 0.5, z: -15 }, name: '东南消火栓', pressure: 0.7 },
    { id: 'wh3', position: { x: -25, y: 0.5, z: 15 }, name: '西北消火栓', pressure: 0.7 },
    { id: 'wh4', position: { x: 25, y: 0.5, z: 15 }, name: '东北消火栓', pressure: 0.7 },
    { id: 'wh5', position: { x: 0, y: 0.5, z: -5 }, name: '中央南消火栓', pressure: 0.65 },
    { id: 'wh6', position: { x: 0, y: 0.5, z: 5 }, name: '中央北消火栓', pressure: 0.65 },
  ],
  staircases: [],
};

export const allBuildings: BuildingModel[] = [
  officeBuilding,
  residentialBuilding,
  warehouseBuilding,
];
