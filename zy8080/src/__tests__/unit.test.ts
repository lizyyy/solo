import { parseDimension, toMM, toInch, toPoints, formatDimension } from '../parser/unit';

describe('Unit Conversion Tests', () => {
  test('parseDimension should parse mm correctly', () => {
    const result = parseDimension('100mm');
    expect(result.value).toBe(100);
    expect(result.unit).toBe('mm');
  });

  test('parseDimension should parse inch correctly', () => {
    const result = parseDimension('4in');
    expect(result.value).toBe(4);
    expect(result.unit).toBe('in');
  });

  test('parseDimension should parse pt correctly', () => {
    const result = parseDimension('72pt');
    expect(result.value).toBe(72);
    expect(result.unit).toBe('pt');
  });

  test('parseDimension should handle numeric input', () => {
    const result = parseDimension(100);
    expect(result.value).toBe(100);
    expect(result.unit).toBe('mm');
  });

  test('toMM should convert mm to mm', () => {
    expect(toMM({ value: 100, unit: 'mm' })).toBe(100);
  });

  test('toMM should convert inch to mm', () => {
    expect(toMM({ value: 1, unit: 'in' })).toBe(25.4);
  });

  test('toMM should convert pt to mm', () => {
    expect(toMM({ value: 72, unit: 'pt' })).toBeCloseTo(25.4, 5);
  });

  test('toInch should convert mm to inch', () => {
    expect(toInch({ value: 25.4, unit: 'mm' })).toBe(1);
  });

  test('toPoints should convert inch to points', () => {
    expect(toPoints({ value: 1, unit: 'in' })).toBe(72);
  });

  test('formatDimension should format correctly', () => {
    const dim = { value: 25.4, unit: 'mm' as const };
    expect(formatDimension(dim, 'in')).toBe('1.00in');
  });
});
