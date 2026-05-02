import { createLevel, cloneLevel, resizeLevel, clearLevel, positionsEqual, containsPosition, removePosition, isValidPosition, isBlocked, getNeighbors, createCustomer, createSign, } from '../models/level';
import { Position, Direction } from '../models/types';

describe('Level Model', () => {
  describe('createLevel', () => {
    it('should create a level with default values', () => {
      const level = createLevel(10, 8, 'Test Level');
      
      expect(level.width).toBe(10);
      expect(level.height).toBe(8);
      expect(level.name).toBe('Test Level');
      expect(level.walls).toEqual([]);
      expect(level.exits).toEqual([]);
      expect(level.smokeSources).toEqual([]);
      expect(level.customers).toEqual([]);
      expect(level.signs).toEqual([]);
    });
  });
  
  describe('positionsEqual', () => {
    it('should return true for same positions', () => {
      const a: Position = { x: 2, y: 3 };
      const b: Position = { x: 2, y: 3 };
      
      expect(positionsEqual(a, b)).toBe(true);
    });
    
    it('should return false for different positions', () => {
      const a: Position = { x: 2, y: 3 };
      const b: Position = { x: 3, y: 2 };
      
      expect(positionsEqual(a, b)).toBe(false);
    });
  });
  
  describe('containsPosition', () => {
    it('should return true if position is in array', () => {
      const positions: Position[] = [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 2, y: 2 },
      ];
      
      expect(containsPosition(positions, { x: 1, y: 1 })).toBe(true);
    });
    
    it('should return false if position is not in array', () => {
      const positions: Position[] = [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ];
      
      expect(containsPosition(positions, { x: 2, y: 2 })).toBe(false);
    });
  });
  
  describe('removePosition', () => {
    it('should remove position from array', () => {
      const positions: Position[] = [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 2, y: 2 },
      ];
      
      const result = removePosition(positions, { x: 1, y: 1 });
      
      expect(result).toHaveLength(2);
      expect(containsPosition(result, { x: 1, y: 1 })).toBe(false);
    });
  });
  
  describe('isValidPosition', () => {
    const level = createLevel(10, 8);
    
    it('should return true for valid position', () => {
      expect(isValidPosition(level, { x: 0, y: 0 })).toBe(true);
      expect(isValidPosition(level, { x: 9, y: 7 })).toBe(true);
      expect(isValidPosition(level, { x: 5, y: 4 })).toBe(true);
    });
    
    it('should return false for invalid position', () => {
      expect(isValidPosition(level, { x: -1, y: 0 })).toBe(false);
      expect(isValidPosition(level, { x: 0, y: -1 })).toBe(false);
      expect(isValidPosition(level, { x: 10, y: 0 })).toBe(false);
      expect(isValidPosition(level, { x: 0, y: 8 })).toBe(false);
    });
  });
  
  describe('isBlocked', () => {
    it('should return true if position is a wall', () => {
      const level = createLevel(10, 8);
      level.walls.push({ x: 2, y: 3 });
      
      expect(isBlocked(level, { x: 2, y: 3 })).toBe(true);
    });
    
    it('should return false if position is not a wall', () => {
      const level = createLevel(10, 8);
      
      expect(isBlocked(level, { x: 2, y: 3 })).toBe(false);
    });
  });
  
  describe('getNeighbors', () => {
    it('should return four neighbors', () => {
      const position: Position = { x: 5, y: 5 };
      const neighbors = getNeighbors(position);
      
      expect(neighbors).toHaveLength(4);
      expect(neighbors).toContainEqual({ x: 5, y: 4 });
      expect(neighbors).toContainEqual({ x: 6, y: 5 });
      expect(neighbors).toContainEqual({ x: 5, y: 6 });
      expect(neighbors).toContainEqual({ x: 4, y: 5 });
    });
  });
  
  describe('cloneLevel', () => {
    it('should create a deep clone of the level', () => {
      const original = createLevel(10, 8, 'Original');
      original.walls.push({ x: 1, y: 1 });
      original.exits.push({ x: 0, y: 0 });
      original.customers.push(createCustomer({ x: 2, y: 2 }));
      original.signs.push(createSign({ x: 3, y: 3 }, Direction.RIGHT));
      
      const cloned = cloneLevel(original);
      
      expect(cloned.id).toBe(original.id);
      expect(cloned.name).toBe(original.name);
      expect(cloned.width).toBe(original.width);
      expect(cloned.height).toBe(original.height);
      expect(cloned.walls).toEqual(original.walls);
      expect(cloned.exits).toEqual(original.exits);
      
      cloned.walls.push({ x: 99, y: 99 });
      expect(original.walls).not.toContainEqual({ x: 99, y: 99 });
    });
  });
  
  describe('resizeLevel', () => {
    it('should resize the level and filter out out-of-bounds elements', () => {
      const original = createLevel(10, 10);
      original.walls.push({ x: 8, y: 8 });
      original.walls.push({ x: 9, y: 9 });
      original.customers.push(createCustomer({ x: 9, y: 9 }));
      
      const resized = resizeLevel(original, 8, 8);
      
      expect(resized.width).toBe(8);
      expect(resized.height).toBe(8);
      expect(resized.walls).toContainEqual({ x: 8, y: 8 });
      expect(resized.walls).not.toContainEqual({ x: 9, y: 9 });
      expect(resized.customers).toHaveLength(0);
    });
  });
  
  describe('clearLevel', () => {
    it('should clear all elements from the level', () => {
      const original = createLevel(10, 8, 'Test');
      original.walls.push({ x: 1, y: 1 });
      original.exits.push({ x: 0, y: 0 });
      original.smokeSources.push({ x: 5, y: 5 });
      original.customers.push(createCustomer({ x: 2, y: 2 }));
      original.signs.push(createSign({ x: 3, y: 3 }, Direction.RIGHT));
      
      const cleared = clearLevel(original);
      
      expect(cleared.id).toBe(original.id);
      expect(cleared.name).toBe(original.name);
      expect(cleared.width).toBe(original.width);
      expect(cleared.height).toBe(original.height);
      expect(cleared.walls).toEqual([]);
      expect(cleared.exits).toEqual([]);
      expect(cleared.smokeSources).toEqual([]);
      expect(cleared.customers).toEqual([]);
      expect(cleared.signs).toEqual([]);
    });
  });
});
