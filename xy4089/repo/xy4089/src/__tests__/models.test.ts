import { describe, it, expect } from 'vitest';
import {
  createVector3,
  cloneVector3,
  addVectors,
  subtractVectors,
  multiplyVectorScalar,
  vectorDistance,
  vectorLength,
  vectorNormalize,
  vectorsEqual,
  createTruss,
  createHoistPoint,
  createEquipment,
  createProject,
  createDefaultProjectSettings,
  getTrussWeight,
  getTrussCenter,
} from '../models';

describe('Vector3 operations', () => {
  it('should create a vector with default values', () => {
    const v = createVector3();
    expect(v.x).toBe(0);
    expect(v.y).toBe(0);
    expect(v.z).toBe(0);
  });

  it('should create a vector with specified values', () => {
    const v = createVector3(1, 2, 3);
    expect(v.x).toBe(1);
    expect(v.y).toBe(2);
    expect(v.z).toBe(3);
  });

  it('should clone a vector', () => {
    const original = createVector3(1, 2, 3);
    const cloned = cloneVector3(original);
    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
  });

  it('should add two vectors', () => {
    const a = createVector3(1, 2, 3);
    const b = createVector3(4, 5, 6);
    const result = addVectors(a, b);
    expect(result.x).toBe(5);
    expect(result.y).toBe(7);
    expect(result.z).toBe(9);
  });

  it('should subtract two vectors', () => {
    const a = createVector3(5, 7, 9);
    const b = createVector3(4, 5, 6);
    const result = subtractVectors(a, b);
    expect(result.x).toBe(1);
    expect(result.y).toBe(2);
    expect(result.z).toBe(3);
  });

  it('should multiply vector by scalar', () => {
    const v = createVector3(1, 2, 3);
    const result = multiplyVectorScalar(v, 2);
    expect(result.x).toBe(2);
    expect(result.y).toBe(4);
    expect(result.z).toBe(6);
  });

  it('should calculate distance between vectors', () => {
    const a = createVector3(0, 0, 0);
    const b = createVector3(3, 4, 0);
    const distance = vectorDistance(a, b);
    expect(distance).toBe(5);
  });

  it('should calculate vector length', () => {
    const v = createVector3(3, 4, 0);
    expect(vectorLength(v)).toBe(5);
  });

  it('should normalize a vector', () => {
    const v = createVector3(3, 4, 0);
    const normalized = vectorNormalize(v);
    expect(vectorLength(normalized)).toBeCloseTo(1);
  });

  it('should check if vectors are equal', () => {
    const a = createVector3(1, 2, 3);
    const b = createVector3(1, 2, 3);
    const c = createVector3(1, 2, 3.0001);
    const d = createVector3(1, 2, 4);

    expect(vectorsEqual(a, b)).toBe(true);
    expect(vectorsEqual(a, c)).toBe(true);
    expect(vectorsEqual(a, d)).toBe(false);
  });
});

describe('Truss factory', () => {
  it('should create a truss with default values', () => {
    const truss = createTruss();
    expect(truss.type).toBe('box');
    expect(truss.length).toBe(6);
    expect(truss.weightPerMeter).toBe(12);
    expect(truss.color).toBe('#4a90d9');
  });

  it('should create a truss with custom values', () => {
    const truss = createTruss({
      name: 'Test Truss',
      type: 'triangular',
      length: 8,
      position: createVector3(1, 2, 3),
    });
    expect(truss.name).toBe('Test Truss');
    expect(truss.type).toBe('triangular');
    expect(truss.length).toBe(8);
    expect(truss.position).toEqual({ x: 1, y: 2, z: 3 });
  });

  it('should calculate truss weight correctly', () => {
    const truss = createTruss({ length: 6, weightPerMeter: 12 });
    expect(getTrussWeight(truss)).toBe(72);
  });

  it('should get truss center correctly', () => {
    const truss = createTruss({
      position: createVector3(0, 5, 0),
      height: 0.5,
    });
    const center = getTrussCenter(truss);
    expect(center.y).toBe(5.25);
  });
});

describe('HoistPoint factory', () => {
  it('should create a hoist point with default values', () => {
    const hp = createHoistPoint();
    expect(hp.maxLoad).toBe(500);
    expect(hp.currentLoad).toBe(0);
    expect(hp.color).toBe('#ff9800');
  });

  it('should create a hoist point with custom values', () => {
    const hp = createHoistPoint({
      name: 'Test Hoist',
      maxLoad: 1000,
      position: createVector3(5, 10, 0),
    });
    expect(hp.name).toBe('Test Hoist');
    expect(hp.maxLoad).toBe(1000);
    expect(hp.position).toEqual({ x: 5, y: 10, z: 0 });
  });
});

describe('Equipment factory', () => {
  it('should create equipment with default values', () => {
    const eq = createEquipment();
    expect(eq.type).toBe('generic');
    expect(eq.weight).toBe(5);
    expect(eq.color).toBe('#607d8b');
  });

  it('should create a light with correct defaults', () => {
    const eq = createEquipment({ type: 'light' });
    expect(eq.type).toBe('light');
    expect(eq.weight).toBe(15);
    expect(eq.color).toBe('#ffeb3b');
  });

  it('should create a speaker with correct defaults', () => {
    const eq = createEquipment({ type: 'speaker' });
    expect(eq.type).toBe('speaker');
    expect(eq.weight).toBe(25);
    expect(eq.color).toBe('#9c27b0');
  });

  it('should create an LED with correct defaults', () => {
    const eq = createEquipment({ type: 'led' });
    expect(eq.type).toBe('led');
    expect(eq.weight).toBe(10);
    expect(eq.color).toBe('#00bcd4');
  });

  it('should create equipment with custom values', () => {
    const eq = createEquipment({
      name: 'Test Light',
      weight: 20,
      position: createVector3(2, 5, 0),
    });
    expect(eq.name).toBe('Test Light');
    expect(eq.weight).toBe(20);
    expect(eq.position).toEqual({ x: 2, y: 5, z: 0 });
  });
});

describe('Project factory', () => {
  it('should create a project with default values', () => {
    const project = createProject();
    expect(project.name).toBe('新项目');
    expect(project.trusses).toEqual([]);
    expect(project.hoistPoints).toEqual([]);
    expect(project.equipment).toEqual([]);
    expect(project.boundaries).toEqual([]);
    expect(project.settings).toEqual(createDefaultProjectSettings());
  });

  it('should create a project with custom values', () => {
    const truss = createTruss();
    const hp = createHoistPoint();
    const eq = createEquipment();

    const project = createProject({
      name: 'Test Project',
      description: 'A test project',
      trusses: [truss],
      hoistPoints: [hp],
      equipment: [eq],
    });

    expect(project.name).toBe('Test Project');
    expect(project.description).toBe('A test project');
    expect(project.trusses.length).toBe(1);
    expect(project.hoistPoints.length).toBe(1);
    expect(project.equipment.length).toBe(1);
  });

  it('should clone project data deeply', () => {
    const truss = createTruss({ name: 'Original' });
    const project = createProject({ trusses: [truss] });
    
    project.trusses[0].name = 'Modified';
    
    expect(project.trusses[0].name).toBe('Modified');
    expect(truss.name).toBe('Original');
  });
});
