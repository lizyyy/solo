import { describe, it, expect } from 'vitest';
import { calculateStowage, getUnplacedCargo, getBayLoad } from '@/calculator/stowageCalculator';
import type { StowageState } from '@/types';

describe('Stowage Calculator', () => {
  const createTestState = (): StowageState => ({
    bays: [
      { id: 'bay-1', name: 'A1', position: { x: -8, y: 0, z: -5 }, dimensions: { width: 6, height: 4, depth: 8 }, maxWeight: 200, isDeck: false },
      { id: 'bay-2', name: 'A2', position: { x: 8, y: 0, z: -5 }, dimensions: { width: 6, height: 4, depth: 8 }, maxWeight: 200, isDeck: false },
    ],
    cargoItems: [
      { id: 'c1', containerNo: 'CSLU1234567', weight: 25, category: 'general', isDangerous: false, length: 12, width: 2.4, height: 2.6 },
      { id: 'c2', containerNo: 'CSLU1234568', weight: 30, category: 'general', isDangerous: false, length: 12, width: 2.4, height: 2.6 },
      { id: 'c3', containerNo: 'CSLU1234569', weight: null, category: 'general', isDangerous: false, length: 12, width: 2.4, height: 2.6 },
    ],
    placements: [
      { cargoId: 'c1', bayId: 'bay-1', position: { x: 0, y: 2, z: 0 } },
      { cargoId: 'c2', bayId: 'bay-2', position: { x: 0, y: 2, z: 0 } },
    ],
    rules: {
      maxTotalWeight: 1000,
      maxDeckWeight: 300,
      maxCargoHoldWeight: 700,
      balanceLimits: {
        maxPortStarboardDifference: 100,
        maxForeAftDifference: 80,
      },
      dangerousGoods: {
        isolationDistance: 5,
        incompatibleClasses: { 'Class3': ['Class8'] },
      },
    },
  });

  it('should calculate total weight of placed cargo only', () => {
    const state = createTestState();
    const result = calculateStowage(state);
    expect(result.totalWeight).toBe(55);
  });

  it('should calculate center of gravity for placed cargo', () => {
    const state = createTestState();
    const result = calculateStowage(state);
    expect(result.centerOfGravity.x).toBeCloseTo(0.73, 2);
    expect(result.centerOfGravity.y).toBe(2);
    expect(result.centerOfGravity.z).toBe(-5);
  });

  it('should calculate port-starboard balance', () => {
    const state = createTestState();
    const result = calculateStowage(state);
    expect(result.portStarboardBalance).toBe(-5);
  });

  it('should detect overload', () => {
    const state = createTestState();
    state.bays[0].maxWeight = 20;
    const result = calculateStowage(state);
    expect(result.overloadWarnings).toHaveLength(1);
    expect(result.overloadWarnings[0].bayId).toBe('bay-1');
  });

  it('should detect dangerous goods conflicts', () => {
    const state = createTestState();
    state.cargoItems.push({
      id: 'c4',
      containerNo: 'DGXU9999991',
      weight: 15,
      category: 'dangerous',
      isDangerous: true,
      dangerousClass: 'Class3',
      length: 6,
      width: 2.4,
      height: 2.6,
    });
    state.cargoItems.push({
      id: 'c5',
      containerNo: 'DGXU9999992',
      weight: 18,
      category: 'dangerous',
      isDangerous: true,
      dangerousClass: 'Class8',
      length: 6,
      width: 2.4,
      height: 2.6,
    });
    state.placements.push(
      { cargoId: 'c4', bayId: 'bay-1', position: { x: 0, y: 2, z: 0 } },
      { cargoId: 'c5', bayId: 'bay-1', position: { x: 0, y: 2, z: 1 } }
    );
    
    const result = calculateStowage(state);
    expect(result.dangerousGoodsConflicts).toHaveLength(1);
  });

  it('should get unplaced cargo', () => {
    const state = createTestState();
    const unplaced = getUnplacedCargo(state);
    expect(unplaced).toHaveLength(1);
    expect(unplaced[0].id).toBe('c3');
  });

  it('should get bay load', () => {
    const state = createTestState();
    const load = getBayLoad('bay-1', state);
    expect(load).toBe(25);
  });
});