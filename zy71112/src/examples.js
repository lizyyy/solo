export const examples = {
  normal: {
    name: '正常水流模式',
    description: '标准展示区正常工作状态，阀门合理分配各区域水流',
    valves: [
      { id: 'inlet-1', name: '主进水阀 A', type: 'inlet', x: -4, y: 1, z: 0, flowRate: 2.5, direction: { x: 1, y: 0, z: 0 }, active: true, openDegree: 80 },
      { id: 'inlet-2', name: '主进水阀 B', type: 'inlet', x: -4, y: 1, z: 3, flowRate: 2.0, direction: { x: 1, y: 0, z: -0.3 }, active: true, openDegree: 70 },
      { id: 'outlet-1', name: '主出水阀 A', type: 'outlet', x: 4, y: 1, z: 0, flowRate: 2.3, direction: { x: 1, y: 0, z: 0 }, active: true, openDegree: 75 },
      { id: 'outlet-2', name: '主出水阀 B', type: 'outlet', x: 4, y: 1, z: -3, flowRate: 1.8, direction: { x: 1, y: 0, z: 0 }, active: true, openDegree: 65 },
      { id: 'circulation-1', name: '循环阀', type: 'circulation', x: 0, y: 2, z: 0, flowRate: 1.5, direction: { x: 0, y: -1, z: 0 }, active: true, openDegree: 50 }
    ],
    displayZones: [
      { id: 'zone-main', name: '主展示区', x: 0, y: 0, z: 0, width: 4, height: 2.5, depth: 4, type: 'display' },
      { id: 'zone-coral', name: '珊瑚礁区', x: -2, y: 0, z: 2, width: 2, height: 2, depth: 2, type: 'display' }
    ],
    maintenanceZones: [],
    isMaintenance: false,
    flowStatus: 'normal'
  },

  conflict: {
    name: '水流冲突模式',
    description: '阀门方向设置不当导致水流冲突，展示异常状态',
    valves: [
      { id: 'inlet-1', name: '主进水阀 A', type: 'inlet', x: -4, y: 1, z: 0, flowRate: 3.5, direction: { x: 1, y: 0, z: 0.5 }, active: true, openDegree: 100 },
      { id: 'inlet-2', name: '主进水阀 B', type: 'inlet', x: 4, y: 1, z: 0, flowRate: 3.0, direction: { x: -1, y: 0, z: 0.3 }, active: true, openDegree: 95 },
      { id: 'inlet-3', name: '侧进水阀', type: 'inlet', x: 0, y: 1, z: 4, flowRate: 2.0, direction: { x: 0, y: 0, z: -1 }, active: true, openDegree: 80 },
      { id: 'outlet-1', name: '主出水阀', type: 'outlet', x: 0, y: 1, z: -4, flowRate: 1.0, direction: { x: 0, y: 0, z: -1 }, active: true, openDegree: 40 }
    ],
    displayZones: [
      { id: 'zone-main', name: '主展示区', x: 0, y: 0, z: 0, width: 5, height: 2.5, depth: 5, type: 'display' }
    ],
    maintenanceZones: [],
    isMaintenance: false,
    flowStatus: 'conflict'
  },

  empty: {
    name: '空结果模式',
    description: '所有阀门关闭，系统停止运行，模拟维护前状态',
    valves: [
      { id: 'inlet-1', name: '主进水阀 A', type: 'inlet', x: -4, y: 1, z: 0, flowRate: 0, direction: { x: 1, y: 0, z: 0 }, active: false, openDegree: 0 },
      { id: 'inlet-2', name: '主进水阀 B', type: 'inlet', x: -4, y: 1, z: 3, flowRate: 0, direction: { x: 1, y: 0, z: -0.3 }, active: false, openDegree: 0 },
      { id: 'outlet-1', name: '主出水阀 A', type: 'outlet', x: 4, y: 1, z: 0, flowRate: 0, direction: { x: 1, y: 0, z: 0 }, active: false, openDegree: 0 },
      { id: 'outlet-2', name: '主出水阀 B', type: 'outlet', x: 4, y: 1, z: -3, flowRate: 0, direction: { x: 1, y: 0, z: 0 }, active: false, openDegree: 0 },
      { id: 'circulation-1', name: '循环阀', type: 'circulation', x: 0, y: 2, z: 0, flowRate: 0, direction: { x: 0, y: -1, z: 0 }, active: false, openDegree: 0 }
    ],
    displayZones: [
      { id: 'zone-main', name: '主展示区', x: 0, y: 0, z: 0, width: 4, height: 2.5, depth: 4, type: 'display' }
    ],
    maintenanceZones: [
      { id: 'maint-1', name: '维护隔离区', x: 0, y: 0, z: 0, width: 6, height: 3, depth: 6, type: 'maintenance' }
    ],
    isMaintenance: true,
    flowStatus: 'empty'
  }
};

export function getExampleConfig(exampleId) {
  return examples[exampleId] || null;
}
