import { v4 as uuidv4 } from 'uuid';
import type { CircuitComponent, CircuitNode, ComponentType, Bar } from '@/types';

const COMPONENT_SIZES: Record<ComponentType, { width: number; height: number }> = {
  power: { width: 80, height: 60 },
  switch: { width: 60, height: 40 },
  bulb: { width: 50, height: 70 },
  resistor: { width: 70, height: 30 },
  bar: { width: 80, height: 80 },
};

const createNode = (componentId: string, index: number, x: number, y: number): CircuitNode => ({
  id: `${componentId}-node-${index}`,
  componentId,
  index,
  voltage: 0,
  current: 0,
});

export const createComponent = (
  type: ComponentType,
  x: number,
  y: number,
  properties: Partial<CircuitComponent['properties']> = {}
): CircuitComponent => {
  const id = uuidv4();
  const size = COMPONENT_SIZES[type];

  let nodeCount = 2;
  if (type === 'power') nodeCount = 2;
  if (type === 'switch') nodeCount = 2;
  if (type === 'bulb') nodeCount = 2;
  if (type === 'resistor') nodeCount = 2;
  if (type === 'bar') nodeCount = 2;

  const nodes: CircuitNode[] = [];
  for (let i = 0; i < nodeCount; i++) {
    const nodeX = i === 0 ? 0 : size.width;
    const nodeY = size.height / 2;
    nodes.push(createNode(id, i, nodeX, nodeY));
  }

  const defaultProps: CircuitComponent['properties'] = {};

  switch (type) {
    case 'power':
      defaultProps.voltage = properties.voltage || 12;
      defaultProps.current = properties.current || 0;
      break;
    case 'switch':
      break;
    case 'bulb':
      defaultProps.resistance = properties.resistance || 10;
      defaultProps.ratedVoltage = properties.ratedVoltage || 6;
      break;
    case 'resistor':
      defaultProps.resistance = properties.resistance || 10;
      break;
    case 'bar':
      defaultProps.resistance = properties.resistance || 5;
      defaultProps.barId = properties.barId;
      defaultProps.ratedVoltage = properties.ratedVoltage || 6;
      break;
  }

  return {
    id,
    type,
    x,
    y,
    width: size.width,
    height: size.height,
    state: type === 'switch' ? 'off' : 'normal',
    properties: { ...defaultProps, ...properties },
    nodes,
  };
};

export const createWire = (fromNodeId: string, toNodeId: string) => ({
  id: uuidv4(),
  fromNodeId,
  toNodeId,
  current: 0,
  isShort: false,
  isActive: false,
});

export const createBar = (id: number, name: string, requiredVoltage: number): Bar => ({
  id,
  name,
  currentVoltage: 0,
  requiredVoltage,
  status: 'off',
  bulbBrightness: 0,
});

export const createInitialBars = (): Bar[] => [
  createBar(1, '主吧台', 6),
  createBar(2, 'DJ台', 3),
  createBar(3, '舞池', 9),
  createBar(4, '休息区', 6),
  createBar(5, '入口', 12),
];

export const getNodeWorldPosition = (component: CircuitComponent, nodeIndex: number): { x: number; y: number } => {
  const node = component.nodes[nodeIndex];
  if (!node) return { x: component.x, y: component.y };
  return {
    x: component.x + (nodeIndex === 0 ? 0 : component.width),
    y: component.y + component.height / 2,
  };
};

export const getComponentColor = (type: ComponentType): string => {
  switch (type) {
    case 'power':
      return '#F59E0B';
    case 'switch':
      return '#10B981';
    case 'bulb':
      return '#F59E0B';
    case 'resistor':
      return '#8B5CF6';
    case 'bar':
      return '#06B6D4';
    default:
      return '#94A3B8';
  }
};
