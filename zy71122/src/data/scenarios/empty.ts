import type { Scenario } from '@/types';

export const emptyScenario: Scenario = {
  id: 'empty-001',
  name: '空结果测试场景',
  type: 'empty',
  description: '无任何阀门操作或影响区域的场景，用于测试边界情况和重置功能。',
  initialNetwork: {
    nodes: [
      { id: 'n1', x: -10, y: 0, z: 0, type: 'source', pressure: 4.0 },
      { id: 'n2', x: 0, y: 0, z: 0, type: 'junction', pressure: 3.8 },
      { id: 'n3', x: 10, y: 0, z: 0, type: 'junction', pressure: 3.6 },
      { id: 'n4', x: 0, y: 0, z: 10, type: 'junction', pressure: 3.5 },
    ],
    pipes: [
      { id: 'p1', fromNode: 'n1', toNode: 'n2', diameter: 200, length: 300, flowDirection: 'forward' },
      { id: 'p2', fromNode: 'n2', toNode: 'n3', diameter: 150, length: 250, flowDirection: 'forward' },
      { id: 'p3', fromNode: 'n2', toNode: 'n4', diameter: 150, length: 280, flowDirection: 'forward' },
    ],
    valves: [
      { id: 'v1', pipeId: 'p1', position: 0.5, status: 'open', type: 'gate' },
      { id: 'v2', pipeId: 'p2', position: 0.3, status: 'open', type: 'ball' },
      { id: 'v3', pipeId: 'p3', position: 0.3, status: 'open', type: 'ball' },
    ],
    customerZones: [
      { id: 'z1', name: '测试区域A', nodeIds: ['n3'], customerCount: 500, type: 'residential', color: '#607D8B' },
      { id: 'z2', name: '测试区域B', nodeIds: ['n4'], customerCount: 300, type: 'commercial', color: '#795548' },
    ],
    repairPoints: [],
  },
};
