import { describe, it, expect } from 'vitest';
import { PathFinder } from '../src/engine/PathFinder';
import { ExhibitionConfig } from '../src/types';

const testConfig: ExhibitionConfig = {
  version: '1.0.0',
  exhibitionName: '测试',
  exhibitionDate: '2026-01-01',
  venue: '测试',
  floor: {
    width: 20,
    depth: 15,
    height: 0.1,
  },
  elements: [
    {
      id: 'entrance_1',
      type: 'entrance',
      name: '入口',
      position: { x: -9, z: 0 },
      dimensions: { width: 2, depth: 2, height: 0.1 },
    },
    {
      id: 'exit_1',
      type: 'exit',
      name: '出口',
      position: { x: 9, z: 0 },
      dimensions: { width: 2, depth: 2, height: 0.1 },
    },
    {
      id: 'exhibit_1',
      type: 'exhibit',
      name: '展柜1',
      position: { x: 0, z: 0 },
      dimensions: { width: 4, depth: 4, height: 2 },
    },
  ],
};

describe('PathFinder', () => {
  describe('基本功能', () => {
    it('应该能够创建 PathFinder 实例', () => {
      const pathFinder = new PathFinder(testConfig, 1);
      expect(pathFinder).toBeDefined();
    });

    it('应该能够判断位置是否可通行', () => {
      const pathFinder = new PathFinder(testConfig, 1);
      
      expect(pathFinder.isWalkable(-9, 0)).toBe(true);
      expect(pathFinder.isWalkable(9, 0)).toBe(true);
      
      expect(pathFinder.isWalkable(0, 0)).toBe(false);
    });
  });

  describe('路径寻找', () => {
    it('应该能够找到两点之间的路径', () => {
      const pathFinder = new PathFinder(testConfig, 1);
      
      const path = pathFinder.findPath(
        { x: -9, z: 0 },
        { x: 9, z: 0 }
      );
      
      expect(path).toBeDefined();
      expect(path!.length).toBeGreaterThan(0);
      
      expect(path![0].x).toBe(-9);
      expect(path![0].z).toBe(0);
      
      expect(path![path!.length - 1].x).toBe(9);
      expect(path![path!.length - 1].z).toBe(0);
    });

    it('路径应该绕过障碍物', () => {
      const pathFinder = new PathFinder(testConfig, 1);
      
      const path = pathFinder.findPath(
        { x: -9, z: 0 },
        { x: 9, z: 0 }
      );
      
      expect(path).toBeDefined();
      
      for (const point of path!) {
        const blocked = Math.abs(point.x) < 2 && Math.abs(point.z) < 2;
        expect(blocked).toBe(false);
      }
    });

    it('应该能够获取随机可通行位置', () => {
      const pathFinder = new PathFinder(testConfig, 1);
      
      const pos1 = pathFinder.getRandomWalkablePosition();
      const pos2 = pathFinder.getRandomWalkablePosition();
      
      expect(pathFinder.isWalkable(pos1.x, pos1.z)).toBe(true);
      expect(pathFinder.isWalkable(pos2.x, pos2.z)).toBe(true);
    });
  });

  describe('边界情况', () => {
    it('应该处理无法到达的目标', () => {
      const configWithBlockedExit: ExhibitionConfig = {
        ...testConfig,
        elements: [
          ...testConfig.elements,
          {
            id: 'blocker_1',
            type: 'exhibit',
            name: '阻挡',
            position: { x: 6, z: 0 },
            dimensions: { width: 2, depth: 15, height: 2 },
          },
        ],
      };
      
      const pathFinder = new PathFinder(configWithBlockedExit, 1);
      
      const path = pathFinder.findPath(
        { x: -9, z: 0 },
        { x: 9, z: 0 }
      );
      
      expect(path).toBeNull();
    });

    it('起点和终点相同时应该返回单点路径', () => {
      const pathFinder = new PathFinder(testConfig, 1);
      
      const path = pathFinder.findPath(
        { x: -9, z: 0 },
        { x: -9, z: 0 }
      );
      
      expect(path).toBeDefined();
      expect(path!.length).toBe(1);
    });
  });

  describe('网格更新', () => {
    it('应该能够更新配置并重新计算网格', () => {
      const pathFinder = new PathFinder(testConfig, 1);
      
      expect(pathFinder.isWalkable(0, 0)).toBe(false);
      
      const newConfig: ExhibitionConfig = {
        ...testConfig,
        elements: testConfig.elements.filter(e => e.type !== 'exhibit'),
      };
      
      pathFinder.updateGrid(newConfig);
      
      expect(pathFinder.isWalkable(0, 0)).toBe(true);
    });
  });
});
