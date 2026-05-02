import { describe, it, expect } from 'vitest';
import {
  createTruss,
  createHoistPoint,
  createEquipment,
  createDefaultProjectSettings,
  createVector3,
} from '../models';
import {
  calculateCenterOfGravity,
  calculateHoistPointLoads,
  calculateUnbalance,
  calculateImpactFactor,
} from '../physics';

describe('Center of gravity calculation', () => {
  it('should calculate COG for a single truss', () => {
    const truss = createTruss({
      length: 6,
      weightPerMeter: 12,
      position: createVector3(0, 5, 0),
      height: 0.5,
    });

    const result = calculateCenterOfGravity([truss], []);

    expect(result.totalMass).toBe(72);
    expect(result.trussCount).toBe(1);
    expect(result.equipmentCount).toBe(0);
    expect(result.position.x).toBeCloseTo(0);
    expect(result.position.y).toBeCloseTo(5.25);
    expect(result.position.z).toBeCloseTo(0);
  });

  it('should calculate COG for equipment only', () => {
    const eq1 = createEquipment({
      weight: 10,
      position: createVector3(2, 5, 0),
    });
    const eq2 = createEquipment({
      weight: 20,
      position: createVector3(-1, 5, 0),
    });

    const result = calculateCenterOfGravity([], [eq1, eq2]);

    expect(result.totalMass).toBe(30);
    const expectedX = (10 * 2 + 20 * -1) / 30;
    expect(result.position.x).toBeCloseTo(expectedX);
  });

  it('should return origin for empty scene', () => {
    const result = calculateCenterOfGravity([], []);

    expect(result.totalMass).toBe(0);
    expect(result.position).toEqual({ x: 0, y: 0, z: 0 });
  });
});

describe('Hoist point load calculation', () => {
  it('should distribute load evenly for centered equipment', () => {
    const settings = createDefaultProjectSettings();
    
    const truss = createTruss({
      id: 'truss-1',
      length: 6,
      weightPerMeter: 12,
      position: createVector3(0, 5, 0),
    });

    const hp1 = createHoistPoint({
      id: 'hp-1',
      maxLoad: 500,
      position: createVector3(-2.5, 7, 0),
      trussId: 'truss-1',
      trussLocalPosition: createVector3(0.5, 0.25, 0),
    });

    const hp2 = createHoistPoint({
      id: 'hp-2',
      maxLoad: 500,
      position: createVector3(2.5, 7, 0),
      trussId: 'truss-1',
      trussLocalPosition: createVector3(5.5, 0.25, 0),
    });

    const eq = createEquipment({
      weight: 100,
      position: createVector3(0, 5.5, 0),
      trussId: 'truss-1',
    });

    const result = calculateHoistPointLoads(
      [truss],
      [hp1, hp2],
      [eq],
      settings
    );

    expect(result.length).toBe(2);

    const hp1Result = result.find(r => r.hoistPointId === 'hp-1')!;
    const hp2Result = result.find(r => r.hoistPointId === 'hp-2')!;

    const totalTrussWeight = 72;
    const totalWeight = totalTrussWeight + 100;
    
    expect(hp1Result.staticLoad + hp2Result.staticLoad).toBeCloseTo(totalWeight);
  });

  it('should mark overloaded hoist points', () => {
    const settings = createDefaultProjectSettings();
    
    const truss = createTruss({
      id: 'truss-1',
      length: 6,
      weightPerMeter: 12,
      position: createVector3(0, 5, 0),
    });

    const hp1 = createHoistPoint({
      id: 'hp-1',
      maxLoad: 10,
      position: createVector3(-2.5, 7, 0),
      trussId: 'truss-1',
      trussLocalPosition: createVector3(0.5, 0.25, 0),
    });

    const hp2 = createHoistPoint({
      id: 'hp-2',
      maxLoad: 10,
      position: createVector3(2.5, 7, 0),
      trussId: 'truss-1',
      trussLocalPosition: createVector3(5.5, 0.25, 0),
    });

    const eq = createEquipment({
      weight: 100,
      position: createVector3(0, 5.5, 0),
      trussId: 'truss-1',
    });

    const result = calculateHoistPointLoads(
      [truss],
      [hp1, hp2],
      [eq],
      settings
    );

    expect(result.every(r => r.isOverloaded)).toBe(true);
    expect(result.every(r => r.loadRatio > 1)).toBe(true);
  });
});

describe('Unbalance calculation', () => {
  it('should detect balanced system', () => {
    const settings = createDefaultProjectSettings();
    
    const truss = createTruss({
      id: 'truss-1',
      length: 6,
      position: createVector3(0, 5, 0),
    });

    const hp1 = createHoistPoint({
      id: 'hp-1',
      position: createVector3(-3, 7, 0),
      maxLoad: 500,
    });

    const hp2 = createHoistPoint({
      id: 'hp-2',
      position: createVector3(3, 7, 0),
      maxLoad: 500,
    });

    const eq1 = createEquipment({
      weight: 50,
      position: createVector3(-1, 5.5, 0),
    });

    const eq2 = createEquipment({
      weight: 50,
      position: createVector3(1, 5.5, 0),
    });

    const result = calculateUnbalance([truss], [hp1, hp2], [eq1, eq2], settings);

    expect(result.isUnbalanced).toBe(false);
    expect(result.maxRatio).toBeLessThan(settings.maxUnbalanceRatio);
  });

  it('should detect unbalanced system', () => {
    const settings = createDefaultProjectSettings();
    
    const truss = createTruss({
      id: 'truss-1',
      length: 6,
      position: createVector3(0, 5, 0),
    });

    const hp1 = createHoistPoint({
      id: 'hp-1',
      position: createVector3(-3, 7, 0),
      maxLoad: 500,
    });

    const hp2 = createHoistPoint({
      id: 'hp-2',
      position: createVector3(3, 7, 0),
      maxLoad: 500,
    });

    const eqHeavy = createEquipment({
      weight: 200,
      position: createVector3(-2.5, 5.5, 0),
    });

    const eqLight = createEquipment({
      weight: 10,
      position: createVector3(2.5, 5.5, 0),
    });

    const result = calculateUnbalance([truss], [hp1, hp2], [eqHeavy, eqLight], settings);

    expect(result.isUnbalanced).toBe(true);
    expect(result.maxRatio).toBeGreaterThan(settings.maxUnbalanceRatio);
  });
});

describe('Impact factor calculation', () => {
  it('should calculate base impact factor', () => {
    const settings = createDefaultProjectSettings();
    
    const result = calculateImpactFactor(settings, 0, 0);

    expect(result.baseFactor).toBe(settings.dynamicImpactFactorBase);
    expect(result.speedFactor).toBe(1);
    expect(result.accelerationFactor).toBe(1);
    expect(result.totalFactor).toBe(settings.dynamicImpactFactorBase);
  });

  it('should increase impact factor with speed', () => {
    const settings = createDefaultProjectSettings();
    
    const resultSlow = calculateImpactFactor(settings, 0.5, 0);
    const resultFast = calculateImpactFactor(settings, 2.0, 0);

    expect(resultFast.totalFactor).toBeGreaterThan(resultSlow.totalFactor);
  });

  it('should increase impact factor with acceleration', () => {
    const settings = createDefaultProjectSettings();
    
    const resultSlow = calculateImpactFactor(settings, 0, 0.5);
    const resultFast = calculateImpactFactor(settings, 0, 2.0);

    expect(resultFast.totalFactor).toBeGreaterThan(resultSlow.totalFactor);
  });
});
