import { calculateBoundingBox, calculateSafeArea, doBoxesOverlap, preflightCheck } from '../geometry';
import { Workpiece, JobConfig } from '../types';

describe('Geometry Tests', () => {
  const createWorkpiece = (x: number, y: number, width: number = 100, height: number = 100): Workpiece => ({
    id: 'test',
    name: 'Test',
    width: { value: width, unit: 'mm' },
    height: { value: height, unit: 'mm' },
    bleed: { value: 3, unit: 'mm' },
    safeMargin: { value: 5, unit: 'mm' },
    rotation: 0,
    copies: 1,
    x,
    y
  });

  test('calculateBoundingBox should return correct box for no rotation', () => {
    const wp = createWorkpiece(100, 100);
    const box = calculateBoundingBox(wp);
    
    expect(box.x).toBe(97);
    expect(box.y).toBe(97);
    expect(box.width).toBe(106);
    expect(box.height).toBe(106);
  });

  test('calculateBoundingBox should return correct box for 90 degree rotation', () => {
    const wp = { ...createWorkpiece(100, 100), rotation: 90 };
    const box = calculateBoundingBox(wp);
    
    expect(box.x).toBe(97);
    expect(box.y).toBe(97);
    expect(box.width).toBe(106);
    expect(box.height).toBe(106);
  });

  test('calculateSafeArea should return correct box', () => {
    const wp = createWorkpiece(100, 100);
    const area = calculateSafeArea(wp);
    
    expect(area.x).toBe(105);
    expect(area.y).toBe(105);
    expect(area.width).toBe(90);
    expect(area.height).toBe(90);
  });

  test('doBoxesOverlap should detect overlapping boxes', () => {
    const box1 = { x: 0, y: 0, width: 100, height: 100 };
    const box2 = { x: 50, y: 50, width: 100, height: 100 };
    
    expect(doBoxesOverlap(box1, box2)).toBe(true);
  });

  test('doBoxesOverlap should detect non-overlapping boxes', () => {
    const box1 = { x: 0, y: 0, width: 100, height: 100 };
    const box2 = { x: 150, y: 150, width: 100, height: 100 };
    
    expect(doBoxesOverlap(box1, box2)).toBe(false);
  });

  test('preflightCheck should detect workpiece outside paper', () => {
    const config: JobConfig = {
      id: 'test',
      name: 'Test',
      paper: { name: 'A4', width: { value: 210, unit: 'mm' }, height: { value: 297, unit: 'mm' } },
      bleed: { value: 3, unit: 'mm' },
      safeMargin: { value: 5, unit: 'mm' },
      workpieces: [
        {
          id: 'wp1',
          name: 'Outside',
          width: { value: 100, unit: 'mm' },
          height: { value: 100, unit: 'mm' },
          rotation: 0,
          copies: 1,
          x: 500,
          y: 500
        }
      ]
    };

    const result = preflightCheck(config);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].code).toBe('WP_wp1_OUTSIDE');
  });

  test('preflightCheck should detect bleed warning', () => {
    const config: JobConfig = {
      id: 'test',
      name: 'Test',
      paper: { name: 'A4', width: { value: 210, unit: 'mm' }, height: { value: 297, unit: 'mm' } },
      bleed: { value: 2, unit: 'mm' },
      safeMargin: { value: 5, unit: 'mm' },
      workpieces: [
        createWorkpiece(100, 100)
      ]
    };

    const result = preflightCheck(config);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  test('preflightCheck should pass for valid config', () => {
    const config: JobConfig = {
      id: 'test',
      name: 'Test',
      paper: { name: 'A4', width: { value: 210, unit: 'mm' }, height: { value: 297, unit: 'mm' } },
      bleed: { value: 3, unit: 'mm' },
      safeMargin: { value: 5, unit: 'mm' },
      workpieces: [
        createWorkpiece(100, 100)
      ]
    };

    const result = preflightCheck(config);
    expect(result.passed).toBe(true);
  });
});
