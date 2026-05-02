import { Level, Direction } from '../models/types';
import { createLevel, createCustomer, createSign } from '../models/level';

export function createSimpleLevel(): Level {
  const level = createLevel(8, 6, '简单关卡');
  
  level.walls = [
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 }, { x: 6, y: 0 }, { x: 7, y: 0 },
    { x: 0, y: 5 }, { x: 1, y: 5 }, { x: 2, y: 5 }, { x: 3, y: 5 }, { x: 4, y: 5 }, { x: 5, y: 5 }, { x: 6, y: 5 }, { x: 7, y: 5 },
    { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 3 }, { x: 0, y: 4 },
    { x: 7, y: 1 }, { x: 7, y: 2 }, { x: 7, y: 3 }, { x: 7, y: 4 },
    { x: 3, y: 2 }, { x: 4, y: 2 },
    { x: 3, y: 4 }, { x: 4, y: 4 },
  ];
  
  level.exits = [
    { x: 0, y: 3 },
    { x: 7, y: 2 },
  ];
  
  level.smokeSources = [
    { x: 5, y: 3 },
  ];
  
  level.customers = [
    createCustomer({ x: 2, y: 2 }),
    createCustomer({ x: 5, y: 1 }),
    createCustomer({ x: 1, y: 4 }),
  ];
  
  level.signs = [
    createSign({ x: 2, y: 3 }, Direction.LEFT),
    createSign({ x: 6, y: 2 }, Direction.RIGHT),
  ];
  
  return level;
}

export function createMediumLevel(): Level {
  const level = createLevel(10, 8, '中等关卡');
  
  level.walls = [
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 }, { x: 6, y: 0 }, { x: 7, y: 0 }, { x: 8, y: 0 }, { x: 9, y: 0 },
    { x: 0, y: 7 }, { x: 1, y: 7 }, { x: 2, y: 7 }, { x: 3, y: 7 }, { x: 4, y: 7 }, { x: 5, y: 7 }, { x: 6, y: 7 }, { x: 7, y: 7 }, { x: 8, y: 7 }, { x: 9, y: 7 },
    { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 3 }, { x: 0, y: 4 }, { x: 0, y: 5 }, { x: 0, y: 6 },
    { x: 9, y: 1 }, { x: 9, y: 2 }, { x: 9, y: 3 }, { x: 9, y: 4 }, { x: 9, y: 5 }, { x: 9, y: 6 },
    { x: 2, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 2 },
    { x: 2, y: 5 }, { x: 3, y: 5 }, { x: 4, y: 5 },
    { x: 6, y: 3 }, { x: 7, y: 3 },
    { x: 6, y: 4 }, { x: 7, y: 4 },
  ];
  
  level.exits = [
    { x: 0, y: 4 },
    { x: 9, y: 3 },
  ];
  
  level.smokeSources = [
    { x: 4, y: 3 },
    { x: 7, y: 2 },
  ];
  
  level.customers = [
    createCustomer({ x: 1, y: 1 }),
    createCustomer({ x: 1, y: 6 }),
    createCustomer({ x: 5, y: 1 }),
    createCustomer({ x: 5, y: 6 }),
    createCustomer({ x: 8, y: 1 }),
  ];
  
  level.signs = [
    createSign({ x: 1, y: 2 }, Direction.DOWN),
    createSign({ x: 1, y: 3 }, Direction.LEFT),
    createSign({ x: 8, y: 5 }, Direction.UP),
    createSign({ x: 8, y: 3 }, Direction.RIGHT),
  ];
  
  return level;
}

export function createHardLevel(): Level {
  const level = createLevel(12, 10, '困难关卡');
  
  level.walls = [
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 }, { x: 6, y: 0 }, { x: 7, y: 0 }, { x: 8, y: 0 }, { x: 9, y: 0 }, { x: 10, y: 0 }, { x: 11, y: 0 },
    { x: 0, y: 9 }, { x: 1, y: 9 }, { x: 2, y: 9 }, { x: 3, y: 9 }, { x: 4, y: 9 }, { x: 5, y: 9 }, { x: 6, y: 9 }, { x: 7, y: 9 }, { x: 8, y: 9 }, { x: 9, y: 9 }, { x: 10, y: 9 }, { x: 11, y: 9 },
    { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 3 }, { x: 0, y: 4 }, { x: 0, y: 5 }, { x: 0, y: 6 }, { x: 0, y: 7 }, { x: 0, y: 8 },
    { x: 11, y: 1 }, { x: 11, y: 2 }, { x: 11, y: 3 }, { x: 11, y: 4 }, { x: 11, y: 5 }, { x: 11, y: 6 }, { x: 11, y: 7 }, { x: 11, y: 8 },
    { x: 3, y: 2 }, { x: 4, y: 2 }, { x: 5, y: 2 },
    { x: 7, y: 2 }, { x: 8, y: 2 },
    { x: 2, y: 4 }, { x: 3, y: 4 },
    { x: 5, y: 4 }, { x: 6, y: 4 }, { x: 7, y: 4 },
    { x: 9, y: 4 },
    { x: 2, y: 6 }, { x: 3, y: 6 },
    { x: 5, y: 6 }, { x: 6, y: 6 },
    { x: 8, y: 6 }, { x: 9, y: 6 },
    { x: 3, y: 8 }, { x: 4, y: 8 }, { x: 5, y: 8 },
    { x: 7, y: 8 }, { x: 8, y: 8 },
  ];
  
  level.exits = [
    { x: 0, y: 5 },
    { x: 11, y: 4 },
  ];
  
  level.smokeSources = [
    { x: 4, y: 5 },
    { x: 8, y: 5 },
    { x: 6, y: 3 },
  ];
  
  level.customers = [
    createCustomer({ x: 1, y: 1 }),
    createCustomer({ x: 1, y: 8 }),
    createCustomer({ x: 10, y: 1 }),
    createCustomer({ x: 10, y: 8 }),
    createCustomer({ x: 5, y: 1 }),
    createCustomer({ x: 6, y: 8 }),
    createCustomer({ x: 9, y: 1 }),
    createCustomer({ x: 4, y: 8 }),
  ];
  
  level.signs = [
    createSign({ x: 1, y: 2 }, Direction.DOWN),
    createSign({ x: 1, y: 3 }, Direction.DOWN),
    createSign({ x: 1, y: 4 }, Direction.DOWN),
    createSign({ x: 1, y: 5 }, Direction.LEFT),
    createSign({ x: 10, y: 2 }, Direction.DOWN),
    createSign({ x: 10, y: 3 }, Direction.RIGHT),
    createSign({ x: 4, y: 1 }, Direction.LEFT),
    createSign({ x: 7, y: 1 }, Direction.RIGHT),
  ];
  
  return level;
}

export const exampleLevels = {
  simple: createSimpleLevel,
  medium: createMediumLevel,
  hard: createHardLevel,
};
