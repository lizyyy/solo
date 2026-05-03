import { v4 as uuidv4 } from 'uuid';
import { LayoutElement, ElementType, Position, Rotation, Scale } from '../types';

export const generateId = (): string => uuidv4();

export const createElement = (
  type: ElementType,
  name: string,
  position: Position = { x: 0, y: 0, z: 0 },
  rotation: Rotation = { x: 0, y: 0, z: 0 },
  scale: Scale = { x: 1, y: 1, z: 1 },
  color?: string
): LayoutElement => {
  const baseElement = {
    id: generateId(),
    type,
    name,
    position,
    rotation,
    scale,
    color,
  };

  switch (type) {
    case 'cabinet':
      return {
        ...baseElement,
        type: 'cabinet',
        description: '',
        visibility: 1,
      };
    case 'entrance':
      return {
        ...baseElement,
        type: 'entrance',
        flowDirection: 0,
        maxCapacity: 100,
      };
    case 'exit':
      return {
        ...baseElement,
        type: 'exit',
        flowDirection: 0,
        maxCapacity: 100,
      };
    case 'interactive_screen':
      return {
        ...baseElement,
        type: 'interactive_screen',
        screenContent: '',
      };
    case 'fire_exit':
      return {
        ...baseElement,
        type: 'fire_exit',
        width: 1.5,
        minimumRequiredWidth: 1.2,
      };
    default:
      throw new Error(`Unknown element type: ${type}`);
  }
};

export const cloneElement = (element: LayoutElement): LayoutElement => {
  return {
    ...element,
    id: generateId(),
    name: `${element.name} (副本)`,
    position: { ...element.position },
    rotation: { ...element.rotation },
    scale: { ...element.scale },
  };
};

export const updateElementPosition = (
  element: LayoutElement,
  position: Position
): LayoutElement => {
  return {
    ...element,
    position: { ...position },
  };
};

export const updateElementRotation = (
  element: LayoutElement,
  rotation: Rotation
): LayoutElement => {
  return {
    ...element,
    rotation: { ...rotation },
  };
};

export const updateElementScale = (
  element: LayoutElement,
  scale: Scale
): LayoutElement => {
  return {
    ...element,
    scale: { ...scale },
  };
};

export const getElementColor = (type: ElementType): string => {
  const colors: Record<ElementType, string> = {
    cabinet: '#8B4513',
    entrance: '#00FF00',
    exit: '#FF0000',
    interactive_screen: '#0000FF',
    fire_exit: '#FFA500',
  };
  return colors[type];
};

export const getElementTypeName = (type: ElementType): string => {
  const names: Record<ElementType, string> = {
    cabinet: '展柜',
    entrance: '入口',
    exit: '出口',
    interactive_screen: '互动屏',
    fire_exit: '消防通道',
  };
  return names[type];
};
