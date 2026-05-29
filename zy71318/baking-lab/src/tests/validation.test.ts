import { describe, it, expect } from 'vitest';
import { 
  validateSimulationParams, 
  validateStateTransition, 
  generateParamSignature,
  hasCriticalErrors,
  ERROR_CODES
} from '../utils/validation';
import type { SimulationParams } from '../types';

const validParams: SimulationParams = {
  id: '',
  materialId: 'aluminum',
  ovenTemperature: 180,
  initialTemperature: 25,
  cakeDimensions: {
    diameter: 20,
    height: 8
  },
  timeStep: 5,
  totalTime: 1800
};

describe('Parameter Validation', () => {
  describe('Missing Fields Validation', () => {
    it('should detect missing materialId', () => {
      const params = { ...validParams, materialId: undefined };
      const result = validateSimulationParams(params as Partial<SimulationParams>);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === ERROR_CODES.MISSING_FIELD && e.field === 'materialId')).toBe(true);
    });

    it('should detect missing ovenTemperature', () => {
      const params = { ...validParams, ovenTemperature: undefined };
      const result = validateSimulationParams(params as Partial<SimulationParams>);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === ERROR_CODES.MISSING_FIELD && e.field === 'ovenTemperature')).toBe(true);
    });

    it('should detect missing cakeDimensions', () => {
      const params = { ...validParams, cakeDimensions: undefined };
      const result = validateSimulationParams(params as Partial<SimulationParams>);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === ERROR_CODES.MISSING_FIELD && e.field === 'cakeDimensions')).toBe(true);
    });

    it('should detect missing cake diameter', () => {
      const params = { 
        ...validParams, 
        cakeDimensions: { ...validParams.cakeDimensions, diameter: undefined as unknown as number }
      };
      const result = validateSimulationParams(params);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === ERROR_CODES.MISSING_FIELD && e.field === 'cakeDimensions.diameter')).toBe(true);
    });

    it('should detect missing timeStep', () => {
      const params = { ...validParams, timeStep: undefined };
      const result = validateSimulationParams(params as Partial<SimulationParams>);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === ERROR_CODES.MISSING_FIELD && e.field === 'timeStep')).toBe(true);
    });
  });

  describe('Temperature Range Validation', () => {
    it('should reject oven temperature below minimum', () => {
      const params = { ...validParams, ovenTemperature: 50 };
      const result = validateSimulationParams(params);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === ERROR_CODES.TEMP_OUT_OF_RANGE && e.field === 'ovenTemperature')).toBe(true);
    });

    it('should reject oven temperature above maximum', () => {
      const params = { ...validParams, ovenTemperature: 300 };
      const result = validateSimulationParams(params);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === ERROR_CODES.TEMP_OUT_OF_RANGE && e.field === 'ovenTemperature')).toBe(true);
    });

    it('should accept valid oven temperature', () => {
      const params = { ...validParams, ovenTemperature: 180 };
      const result = validateSimulationParams(params);
      
      expect(result.errors.some(e => e.field === 'ovenTemperature' && e.code === ERROR_CODES.TEMP_OUT_OF_RANGE)).toBe(false);
    });

    it('should reject initial temperature below minimum', () => {
      const params = { ...validParams, initialTemperature: -10 };
      const result = validateSimulationParams(params);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === ERROR_CODES.TEMP_OUT_OF_RANGE && e.field === 'initialTemperature')).toBe(true);
    });
  });

  describe('Time Step Validation', () => {
    it('should reject time step below minimum', () => {
      const params = { ...validParams, timeStep: 0 };
      const result = validateSimulationParams(params);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === ERROR_CODES.TIME_STEP_OUT_OF_RANGE)).toBe(true);
    });

    it('should reject time step above maximum', () => {
      const params = { ...validParams, timeStep: 60 };
      const result = validateSimulationParams(params);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === ERROR_CODES.TIME_STEP_OUT_OF_RANGE)).toBe(true);
    });

    it('should warn but not block large but valid time step', () => {
      const params = { ...validParams, timeStep: 15 };
      const result = validateSimulationParams(params);
      
      const warning = result.errors.find(e => e.code === ERROR_CODES.TIME_STEP_TOO_LARGE);
      expect(warning).toBeDefined();
      expect(hasCriticalErrors(result.errors)).toBe(false);
    });

    it('should accept recommended time step', () => {
      const params = { ...validParams, timeStep: 5 };
      const result = validateSimulationParams(params);
      
      expect(result.errors.some(e => e.field === 'timeStep')).toBe(false);
    });
  });

  describe('Duplicate Simulation Detection', () => {
    it('should detect duplicate simulation parameters', () => {
      const signature = generateParamSignature(validParams);
      const existingSignatures = [signature];
      
      const result = validateSimulationParams(validParams, existingSignatures);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === ERROR_CODES.DUPLICATE_SIMULATION)).toBe(true);
    });

    it('should allow different parameters', () => {
      const signature = generateParamSignature(validParams);
      const existingSignatures = [signature];
      
      const differentParams = { ...validParams, ovenTemperature: 200 };
      const result = validateSimulationParams(differentParams, existingSignatures);
      
      expect(result.errors.some(e => e.code === ERROR_CODES.DUPLICATE_SIMULATION)).toBe(false);
    });

    it('should generate unique signature for different params', () => {
      const sig1 = generateParamSignature(validParams);
      const sig2 = generateParamSignature({ ...validParams, materialId: 'steel' });
      const sig3 = generateParamSignature({ ...validParams, ovenTemperature: 200 });
      
      expect(sig1).not.toBe(sig2);
      expect(sig1).not.toBe(sig3);
      expect(sig2).not.toBe(sig3);
    });
  });
});

describe('State Transition Validation', () => {
  it('should allow transition from idle to running', () => {
    expect(validateStateTransition('idle', 'running')).toBe(true);
  });

  it('should allow transition from running to completed', () => {
    expect(validateStateTransition('running', 'completed')).toBe(true);
  });

  it('should allow transition from running to error', () => {
    expect(validateStateTransition('running', 'error')).toBe(true);
  });

  it('should allow transition from completed to idle', () => {
    expect(validateStateTransition('completed', 'idle')).toBe(true);
  });

  it('should allow transition from error to idle', () => {
    expect(validateStateTransition('error', 'idle')).toBe(true);
  });

  it('should reject transition from idle to completed directly', () => {
    expect(validateStateTransition('idle', 'completed')).toBe(false);
  });

  it('should reject transition from completed to running', () => {
    expect(validateStateTransition('completed', 'running')).toBe(false);
  });

  it('should reject transition from running to idle directly', () => {
    expect(validateStateTransition('running', 'idle')).toBe(false);
  });

  it('should handle unknown states gracefully', () => {
    expect(validateStateTransition('unknown', 'running')).toBe(false);
    expect(validateStateTransition('idle', 'unknown')).toBe(false);
  });
});

describe('Critical Error Detection', () => {
  it('should identify missing field as critical', () => {
    const errors = [{ field: 'materialId', message: 'Missing', code: ERROR_CODES.MISSING_FIELD }];
    expect(hasCriticalErrors(errors)).toBe(true);
  });

  it('should identify out of range as critical', () => {
    const errors = [{ field: 'ovenTemperature', message: 'Too hot', code: ERROR_CODES.TEMP_OUT_OF_RANGE }];
    expect(hasCriticalErrors(errors)).toBe(true);
  });

  it('should NOT identify time step warning as critical', () => {
    const errors = [{ field: 'timeStep', message: 'Large step', code: ERROR_CODES.TIME_STEP_TOO_LARGE }];
    expect(hasCriticalErrors(errors)).toBe(false);
  });

  it('should consider empty errors as non-critical', () => {
    expect(hasCriticalErrors([])).toBe(false);
  });

  it('should identify mixed errors as critical if any critical exists', () => {
    const errors = [
      { field: 'timeStep', message: 'Large step', code: ERROR_CODES.TIME_STEP_TOO_LARGE },
      { field: 'ovenTemperature', message: 'Too hot', code: ERROR_CODES.TEMP_OUT_OF_RANGE }
    ];
    expect(hasCriticalErrors(errors)).toBe(true);
  });
});

describe('Dimension Validation', () => {
  it('should reject cake diameter below minimum', () => {
    const params = { 
      ...validParams, 
      cakeDimensions: { ...validParams.cakeDimensions, diameter: 5 }
    };
    const result = validateSimulationParams(params);
    
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === ERROR_CODES.DIMENSION_OUT_OF_RANGE && e.field === 'cakeDimensions.diameter')).toBe(true);
  });

  it('should reject cake diameter above maximum', () => {
    const params = { 
      ...validParams, 
      cakeDimensions: { ...validParams.cakeDimensions, diameter: 50 }
    };
    const result = validateSimulationParams(params);
    
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === ERROR_CODES.DIMENSION_OUT_OF_RANGE && e.field === 'cakeDimensions.diameter')).toBe(true);
  });

  it('should reject cake height below minimum', () => {
    const params = { 
      ...validParams, 
      cakeDimensions: { ...validParams.cakeDimensions, height: 1 }
    };
    const result = validateSimulationParams(params);
    
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === ERROR_CODES.DIMENSION_OUT_OF_RANGE && e.field === 'cakeDimensions.height')).toBe(true);
  });

  it('should accept valid cake dimensions', () => {
    const params = { 
      ...validParams, 
      cakeDimensions: { diameter: 20, height: 8 }
    };
    const result = validateSimulationParams(params);
    
    expect(result.errors.some(e => e.code === ERROR_CODES.DIMENSION_OUT_OF_RANGE)).toBe(false);
  });
});
