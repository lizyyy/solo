import { v4 as uuidv4 } from 'uuid';
import { LayoutModel, LayoutElement } from '../types';

const createSampleElement = (
  type: LayoutElement['type'],
  name: string,
  x: number,
  z: number,
  rotationY: number = 0
): LayoutElement => {
  const baseElement = {
    id: uuidv4(),
    type,
    name,
    position: { x, y: 0, z },
    rotation: { x: 0, y: rotationY, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
  };

  switch (type) {
    case 'cabinet':
      return {
        ...baseElement,
        type: 'cabinet',
        description: '',
        visibility: 1,
        color: '#8B4513',
      };
    case 'entrance':
      return {
        ...baseElement,
        type: 'entrance',
        flowDirection: 0,
        maxCapacity: 100,
        color: '#00FF00',
      };
    case 'exit':
      return {
        ...baseElement,
        type: 'exit',
        flowDirection: 0,
        maxCapacity: 100,
        color: '#FF0000',
      };
    case 'interactive_screen':
      return {
        ...baseElement,
        type: 'interactive_screen',
        screenContent: '',
        color: '#0000FF',
      };
    case 'fire_exit':
      return {
        ...baseElement,
        type: 'fire_exit',
        width: 1.5,
        minimumRequiredWidth: 1.2,
        color: '#FFA500',
      };
    default:
      throw new Error(`Unknown element type: ${type}`);
  }
};

export const createSampleLayout = (): LayoutModel => {
  const hallWidth = 20;
  const hallDepth = 15;

  const elements: LayoutElement[] = [
    createSampleElement('entrance', '主入口', 0, -hallDepth / 2 + 2, 0),
    createSampleElement('exit', '主出口', 0, hallDepth / 2 - 2, Math.PI),
    
    createSampleElement('fire_exit', '消防通道A', -hallWidth / 2 + 2, 0, Math.PI / 2),
    createSampleElement('fire_exit', '消防通道B', hallWidth / 2 - 2, 0, -Math.PI / 2),
    
    createSampleElement('cabinet', '展柜A-1', -6, -4, 0),
    createSampleElement('cabinet', '展柜A-2', -3, -4, 0),
    createSampleElement('cabinet', '展柜A-3', 0, -4, 0),
    createSampleElement('cabinet', '展柜A-4', 3, -4, 0),
    createSampleElement('cabinet', '展柜A-5', 6, -4, 0),
    
    createSampleElement('cabinet', '展柜B-1', -6, 4, Math.PI),
    createSampleElement('cabinet', '展柜B-2', -3, 4, Math.PI),
    createSampleElement('cabinet', '展柜B-3', 0, 4, Math.PI),
    createSampleElement('cabinet', '展柜B-4', 3, 4, Math.PI),
    createSampleElement('cabinet', '展柜B-5', 6, 4, Math.PI),
    
    createSampleElement('interactive_screen', '互动屏1', -5, 0, 0),
    createSampleElement('interactive_screen', '互动屏2', 5, 0, Math.PI),
  ];

  return {
    hall: {
      id: uuidv4(),
      name: '临展展厅',
      width: hallWidth,
      depth: hallDepth,
      height: 3,
      walls: [],
      color: '#ffffff',
    },
    elements,
  };
};

export const createLayoutWithIssues = (): LayoutModel => {
  const hallWidth = 20;
  const hallDepth = 15;

  const elements: LayoutElement[] = [
    createSampleElement('entrance', '主入口', 0, -hallDepth / 2 + 2, 0),
    createSampleElement('exit', '主出口', 2, -hallDepth / 2 + 3, 0),
    
    createSampleElement('fire_exit', '消防通道A', -hallWidth / 2 + 2, 0, Math.PI / 2),
    createSampleElement('fire_exit', '消防通道B', hallWidth / 2 - 2, 0, -Math.PI / 2),
    
    createSampleElement('cabinet', '展柜A-1', -2, -5, 0),
    createSampleElement('cabinet', '展柜A-2', -1.5, -5.5, 0),
    createSampleElement('cabinet', '展柜A-3', 0, -5, 0),
    
    createSampleElement('cabinet', '展柜B-1', -6, -4, 0),
    createSampleElement('cabinet', '展柜B-2', -5.5, -3.5, 0),
    
    createSampleElement('cabinet', '阻挡消防通道', -hallWidth / 2 + 4, 0, 0),
    
    createSampleElement('interactive_screen', '互动屏1', -4, 0, 0),
    createSampleElement('interactive_screen', '互动屏2', -3.8, 0.5, 0),
    createSampleElement('interactive_screen', '互动屏3', -3.6, -0.5, 0),
    createSampleElement('interactive_screen', '互动屏4', 5, 0, Math.PI),
  ];

  return {
    hall: {
      id: uuidv4(),
      name: '问题演示展厅',
      width: hallWidth,
      depth: hallDepth,
      height: 3,
      walls: [],
      color: '#ffffff',
    },
    elements,
  };
};

export const createEmptyLayout = (width: number = 20, depth: number = 15): LayoutModel => {
  return {
    hall: {
      id: uuidv4(),
      name: '新建展厅',
      width,
      depth,
      height: 3,
      walls: [],
      color: '#ffffff',
    },
    elements: [],
  };
};
