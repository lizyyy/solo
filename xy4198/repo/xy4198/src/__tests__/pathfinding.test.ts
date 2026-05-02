import { createLevel } from '../models/level';
import { findPath, findNearestExit, heuristic, isOppositeDirection } from '../engine/pathfinding';
import { Position, Direction } from '../models/types';

describe('Pathfinding', () => {
  describe('heuristic', () => {
    it('should calculate Manhattan distance', () => {
      const a: Position = { x: 0, y: 0 };
      const b: Position = { x: 3, y: 4 };
      
      expect(heuristic(a, b)).toBe(7);
    });
    
    it('should return 0 for same position', () => {
      const a: Position = { x: 2, y: 3 };
      
      expect(heuristic(a, a)).toBe(0);
    });
  });
  
  describe('findPath', () => {
    it('should find a path in empty grid', () => {
      const level = createLevel(10, 10);
      const start: Position = { x: 1, y: 1 };
      const goal: Position = { x: 8, y: 8 };
      
      const path = findPath(level, start, goal);
      
      expect(path).not.toBeNull();
      if (path) {
        expect(path[0]).toEqual(start);
        expect(path[path.length - 1]).toEqual(goal);
      }
    });
    
    it('should return null if goal is blocked by walls', () => {
      const level = createLevel(10, 10);
      level.walls = [
        { x: 0, y: 5 }, { x: 1, y: 5 }, { x: 2, y: 5 }, { x: 3, y: 5 },
        { x: 4, y: 5 }, { x: 5, y: 5 }, { x: 6, y: 5 }, { x: 7, y: 5 },
        { x: 8, y: 5 }, { x: 9, y: 5 },
      ];
      
      const start: Position = { x: 1, y: 1 };
      const goal: Position = { x: 8, y: 8 };
      
      const path = findPath(level, start, goal);
      
      expect(path).toBeNull();
    });
    
    it('should find path around single wall', () => {
      const level = createLevel(10, 10);
      level.walls = [{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 2 }];
      
      const start: Position = { x: 1, y: 1 };
      const goal: Position = { x: 5, y: 5 };
      
      const path = findPath(level, start, goal);
      
      expect(path).not.toBeNull();
      if (path) {
        for (const pos of path) {
          const isWall = level.walls.some(w => w.x === pos.x && w.y === pos.y);
          expect(isWall).toBe(false);
        }
      }
    });
  });
  
  describe('findNearestExit', () => {
    it('should find nearest exit', () => {
      const level = createLevel(10, 10);
      level.exits = [{ x: 0, y: 0 }, { x: 9, y: 9 }];
      
      const position: Position = { x: 1, y: 1 };
      
      const nearestExit = findNearestExit(level, position);
      
      expect(nearestExit).toEqual({ x: 0, y: 0 });
    });
    
    it('should return null if no exits', () => {
      const level = createLevel(10, 10);
      const position: Position = { x: 5, y: 5 };
      
      const nearestExit = findNearestExit(level, position);
      
      expect(nearestExit).toBeNull();
    });
    
    it('should handle blocked exit', () => {
      const level = createLevel(10, 10);
      level.exits = [{ x: 0, y: 0 }, { x: 9, y: 9 }];
      
      for (let i = 0; i < 10; i++) {
        if (i !== 5) {
          level.walls.push({ x: i, y: 5 });
        }
      }
      
      const position: Position = { x: 1, y: 1 };
      
      const nearestExit = findNearestExit(level, position);
      
      expect(nearestExit).toEqual({ x: 0, y: 0 });
    });
  });
  
  describe('isOppositeDirection', () => {
    it('should return true for opposite directions', () => {
      expect(isOppositeDirection(Direction.UP, Direction.DOWN)).toBe(true);
      expect(isOppositeDirection(Direction.DOWN, Direction.UP)).toBe(true);
      expect(isOppositeDirection(Direction.LEFT, Direction.RIGHT)).toBe(true);
      expect(isOppositeDirection(Direction.RIGHT, Direction.LEFT)).toBe(true);
    });
    
    it('should return false for non-opposite directions', () => {
      expect(isOppositeDirection(Direction.UP, Direction.LEFT)).toBe(false);
      expect(isOppositeDirection(Direction.UP, Direction.RIGHT)).toBe(false);
      expect(isOppositeDirection(Direction.DOWN, Direction.LEFT)).toBe(false);
      expect(isOppositeDirection(Direction.DOWN, Direction.RIGHT)).toBe(false);
    });
    
    it('should return false if either is null', () => {
      expect(isOppositeDirection(null, Direction.UP)).toBe(false);
      expect(isOppositeDirection(Direction.UP, null)).toBe(false);
      expect(isOppositeDirection(null, null)).toBe(false);
    });
  });
});
