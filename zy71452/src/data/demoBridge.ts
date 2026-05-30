import type { BridgeModel, SourceInfo } from '../types';

const demoSource: SourceInfo = {
  sourceId: 'demo-source',
  fileName: 'demo_bridge.json',
  importedAt: new Date(),
  sourceType: 'processed',
};

const BRIDGE_LENGTH = 80;
const NUM_NODES = 17;
const NODE_SPACING = BRIDGE_LENGTH / (NUM_NODES - 1);
const BRIDGE_HEIGHT = 10;
const DECK_WIDTH = 12;

function generateModeShape(order: number, frequency: number, nodes: string[]) {
  const displacements: Record<string, { x: number; y: number; z: number }> = {};
  
  nodes.forEach((nodeId, index) => {
    const x = (index / (nodes.length - 1)) * Math.PI * order;
    const verticalDisplacement = Math.sin(x) * 0.5;
    const lateralDisplacement = order % 2 === 0 ? Math.sin(x) * 0.2 : 0;
    
    displacements[nodeId] = {
      x: 0,
      y: verticalDisplacement,
      z: lateralDisplacement,
    };
  });
  
  return {
    order,
    frequency,
    frequencyUnit: 'Hz' as const,
    displacements,
    _source: demoSource,
  };
}

export function createDemoBridge(): BridgeModel {
  const nodes: BridgeModel['nodes'] = [];
  const elements: BridgeModel['elements'] = [];
  
  for (let i = 0; i < NUM_NODES; i++) {
    const x = i * NODE_SPACING - BRIDGE_LENGTH / 2;
    
    nodes.push({
      id: `node-${i}`,
      x,
      y: BRIDGE_HEIGHT,
      z: 0,
      _source: demoSource,
    });
    
    if (i < NUM_NODES - 1) {
      elements.push({
        id: `beam-${i}`,
        nodeStartId: `node-${i}`,
        nodeEndId: `node-${i + 1}`,
        type: 'beam',
        _source: demoSource,
      });
    }
  }
  
  const pierPositions = [-BRIDGE_LENGTH / 2, BRIDGE_LENGTH / 2];
  pierPositions.forEach((x, i) => {
    const pierTopId = `pier-top-${i}`;
    const pierBottomId = `pier-bottom-${i}`;
    
    nodes.push(
      {
        id: pierTopId,
        x,
        y: BRIDGE_HEIGHT,
        z: 0,
        _source: demoSource,
      },
      {
        id: pierBottomId,
        x,
        y: 0,
        z: 0,
        _source: demoSource,
      }
    );
    
    elements.push({
      id: `pier-${i}`,
      nodeStartId: pierTopId,
      nodeEndId: pierBottomId,
      type: 'pier',
      _source: demoSource,
    });
  });
  
  const nodeIds = Array.from({ length: NUM_NODES }, (_, i) => `node-${i}`);
  
  const modeShapes = [
    generateModeShape(1, 1.2, nodeIds),
    generateModeShape(2, 3.5, nodeIds),
    generateModeShape(3, 6.8, nodeIds),
    generateModeShape(4, 11.2, nodeIds),
  ];
  
  return {
    id: 'demo-bridge',
    name: '简支梁桥演示模型',
    nodes,
    elements,
    modeShapes,
    length: BRIDGE_LENGTH,
    _source: demoSource,
  };
}
