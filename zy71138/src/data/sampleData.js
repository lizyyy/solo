export const sampleMallData = {
  floors: [
    { id: '1F', name: '一层', y: 0, color: 0x2a2a4a },
    { id: '2F', name: '二层', y: 8, color: 0x2a3a4a },
    { id: '3F', name: '三层', y: 16, color: 0x2a4a4a }
  ],
  escalators: [
    { id: 'ESC-001', name: '扶梯1号', floor: '1F', targetFloor: '2F', x: -15, z: 0, width: 4, length: 12, direction: 'up', status: 'normal' },
    { id: 'ESC-002', name: '扶梯2号', floor: '2F', targetFloor: '3F', x: -15, z: 0, width: 4, length: 12, direction: 'up', status: 'normal' },
    { id: 'ESC-003', name: '扶梯3号', floor: '1F', targetFloor: '2F', x: 15, z: 0, width: 4, length: 12, direction: 'down', status: 'maintenance' },
    { id: 'ESC-004', name: '扶梯4号', floor: '2F', targetFloor: '3F', x: 15, z: 0, width: 4, length: 12, direction: 'down', status: 'normal' }
  ],
  fireDoors: [
    { id: 'FD-001', name: '消防门A', floor: '1F', x: -35, z: 0, width: 3, depth: 0.5, direction: 'west' },
    { id: 'FD-002', name: '消防门B', floor: '1F', x: 35, z: 0, width: 3, depth: 0.5, direction: 'east' },
    { id: 'FD-003', name: '消防门C', floor: '1F', x: 0, z: -25, width: 3, depth: 0.5, direction: 'south' },
    { id: 'FD-004', name: '消防门D', floor: '2F', x: -35, z: 0, width: 3, depth: 0.5, direction: 'west' },
    { id: 'FD-005', name: '消防门E', floor: '2F', x: 35, z: 0, width: 3, depth: 0.5, direction: 'east' },
    { id: 'FD-006', name: '消防门F', floor: '3F', x: -35, z: 0, width: 3, depth: 0.5, direction: 'west' }
  ],
  barriers: [
    { id: 'BAR-001', name: '围挡1号', floor: '1F', x: 10, z: -5, width: 6, depth: 0.5, rotation: 0, color: 0xff6b6b }
  ],
  flowPaths: [
    { id: 'FP-001', floor: '1F', points: [{ x: -30, z: -15 }, { x: -15, z: -15 }, { x: -15, z: 0 }, { x: 15, z: 0 }, { x: 30, z: 0 }], intensity: 0.8 },
    { id: 'FP-002', floor: '1F', points: [{ x: 0, z: -20 }, { x: 0, z: -10 }, { x: 0, z: 10 }, { x: 0, z: 20 }], intensity: 0.6 },
    { id: 'FP-003', floor: '2F', points: [{ x: -30, z: -10 }, { x: -15, z: -10 }, { x: -15, z: 5 }, { x: 15, z: 5 }, { x: 30, z: 5 }], intensity: 0.5 }
  ],
  stores: [
    { id: 'ST-001', name: '品牌店A', floor: '1F', x: -25, z: -15, width: 8, depth: 6 },
    { id: 'ST-002', name: '品牌店B', floor: '1F', x: 25, z: -15, width: 8, depth: 6 },
    { id: 'ST-003', name: '餐饮区', floor: '2F', x: 0, z: -15, width: 12, depth: 8 }
  ]
};
