import assert from 'assert/strict';
import { describe, it } from 'node:test';
import { validateLevel, TileType, PersonType, PersonConfig, LevelState } from '../src/levels.js';

describe('Level Validation', () => {
  it('should validate a correct level', () => {
    const validLevel = {
      id: 'test_001',
      name: 'Test Level',
      duration: 600,
      totalPeople: 30,
      population: {
        normal: 0.6,
        elderly: 0.2,
        child: 0.15,
        disabled: 0.05
      },
      grid: {
        width: 5,
        height: 5,
        tiles: [
          'wall', 'wall', 'wall', 'wall', 'wall',
          'wall', 'entrance', 'floor', 'floor', 'wall',
          'wall', 'floor', 'floor', 'floor', 'wall',
          'wall', 'floor', 'floor', 'exit', 'wall',
          'wall', 'wall', 'wall', 'wall', 'wall'
        ]
      },
      volunteerPositions: [{ x: 2, y: 2 }],
      events: [],
      scoring: {
        pointsPerEvacuation: 10,
        timeBonusPerSecond: 1,
        penaltyPerPanic: 20,
        penaltyPerVolunteerAction: 5,
        penaltyPerBroadcast: 15,
        panicThreshold: 0.3
      }
    };

    const result = validateLevel(validLevel);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.errors.length, 0);
  });

  it('should reject level without ID', () => {
    const invalidLevel = {
      name: 'Test Level',
      duration: 600,
      totalPeople: 30,
      population: { normal: 1.0 },
      grid: {
        width: 3,
        height: 3,
        tiles: ['wall', 'wall', 'wall', 'wall', 'entrance', 'wall', 'wall', 'exit', 'wall']
      },
      volunteerPositions: [{ x: 1, y: 1 }],
      events: [],
      scoring: {}
    };

    const result = validateLevel(invalidLevel);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.includes('缺少关卡ID'));
  });

  it('should reject level with invalid population ratio', () => {
    const invalidLevel = {
      id: 'test_001',
      name: 'Test Level',
      duration: 600,
      totalPeople: 30,
      population: {
        normal: 0.5,
        elderly: 0.5,
        child: 0.5
      },
      grid: {
        width: 3,
        height: 3,
        tiles: ['wall', 'wall', 'wall', 'wall', 'entrance', 'wall', 'wall', 'exit', 'wall']
      },
      volunteerPositions: [{ x: 1, y: 1 }],
      events: [],
      scoring: {}
    };

    const result = validateLevel(invalidLevel);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('人口比例之和')));
  });

  it('should reject level without entrance', () => {
    const invalidLevel = {
      id: 'test_001',
      name: 'Test Level',
      duration: 600,
      totalPeople: 30,
      population: { normal: 1.0 },
      grid: {
        width: 3,
        height: 3,
        tiles: ['wall', 'wall', 'wall', 'wall', 'floor', 'wall', 'wall', 'exit', 'wall']
      },
      volunteerPositions: [{ x: 1, y: 1 }],
      events: [],
      scoring: {}
    };

    const result = validateLevel(invalidLevel);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.includes('至少需要一个入口'));
  });

  it('should reject level without exit', () => {
    const invalidLevel = {
      id: 'test_001',
      name: 'Test Level',
      duration: 600,
      totalPeople: 30,
      population: { normal: 1.0 },
      grid: {
        width: 3,
        height: 3,
        tiles: ['wall', 'wall', 'wall', 'wall', 'entrance', 'wall', 'wall', 'floor', 'wall']
      },
      volunteerPositions: [{ x: 1, y: 1 }],
      events: [],
      scoring: {}
    };

    const result = validateLevel(invalidLevel);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.includes('至少需要一个出口'));
  });
});

describe('TileType Constants', () => {
  it('should have all required tile types', () => {
    assert.ok(TileType.FLOOR);
    assert.ok(TileType.WALL);
    assert.ok(TileType.ENTRANCE);
    assert.ok(TileType.EXIT);
    assert.ok(TileType.OBSTACLE);
    assert.ok(TileType.VOLUNTEER_SPAWN);
  });
});

describe('PersonType Constants', () => {
  it('should have all required person types', () => {
    assert.ok(PersonType.NORMAL);
    assert.ok(PersonType.ELDERLY);
    assert.ok(PersonType.CHILD);
    assert.ok(PersonType.DISABLED);
  });

  it('should have correct config for each person type', () => {
    assert.ok(PersonConfig[PersonType.NORMAL]);
    assert.ok(PersonConfig[PersonType.ELDERLY]);
    assert.ok(PersonConfig[PersonType.CHILD]);
    assert.ok(PersonConfig[PersonType.DISABLED]);

    const normalConfig = PersonConfig[PersonType.NORMAL];
    assert.ok(normalConfig.baseSpeed > 0);
    assert.ok(normalConfig.basePatience > 0);
    assert.ok(normalConfig.color);
    assert.ok(normalConfig.name);
  });

  it('should have elderly with lower speed than normal', () => {
    const elderlyConfig = PersonConfig[PersonType.ELDERLY];
    const normalConfig = PersonConfig[PersonType.NORMAL];
    assert.ok(elderlyConfig.baseSpeed < normalConfig.baseSpeed);
  });

  it('should have children with lower patience than normal', () => {
    const childConfig = PersonConfig[PersonType.CHILD];
    const normalConfig = PersonConfig[PersonType.NORMAL];
    assert.ok(childConfig.basePatience < normalConfig.basePatience);
  });
});

describe('LevelState Constants', () => {
  it('should have all required game states', () => {
    assert.ok(LevelState.NOT_STARTED);
    assert.ok(LevelState.PLAYING);
    assert.ok(LevelState.PAUSED);
    assert.ok(LevelState.WON);
    assert.ok(LevelState.LOST);
  });
});
