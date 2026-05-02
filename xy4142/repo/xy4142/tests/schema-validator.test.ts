import { createSchemaValidator, SchemaValidator } from '../src/core/schema-validator';
import { JSONSchema } from '../src/types';

describe('SchemaValidator', () => {
  let validator: SchemaValidator;

  beforeEach(() => {
    validator = createSchemaValidator();
  });

  describe('registerSchema', () => {
    it('should register a valid schema', () => {
      const schema: JSONSchema = {
        type: 'object',
        required: ['name', 'age'],
        properties: {
          name: { type: 'string' },
          age: { type: 'number' }
        }
      };

      expect(() => validator.registerSchema('test-schema', schema)).not.toThrow();
      expect(validator.hasSchema('test-schema')).toBe(true);
    });

    it('should throw for invalid schema', () => {
      const invalidSchema = {
        type: 'invalid-type'
      } as unknown as JSONSchema;

      expect(() => validator.registerSchema('invalid', invalidSchema)).toThrow();
    });
  });

  describe('validate', () => {
    it('should validate against registered schema', () => {
      const schema: JSONSchema = {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          age: { type: 'number' }
        }
      };

      validator.registerSchema('person', schema);

      const validData = { name: 'John', age: 30 };
      const result1 = validator.validate(validData, 'person');
      expect(result1.valid).toBe(true);
      expect(result1.errors).toHaveLength(0);

      const invalidData = { name: 123 };
      const result2 = validator.validate(invalidData, 'person');
      expect(result2.valid).toBe(false);
      expect(result2.errors.length).toBeGreaterThan(0);
    });

    it('should return error for non-existent schema', () => {
      const result = validator.validate({ name: 'test' }, 'non-existent-schema');
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].keyword).toBe('missing_schema');
    });
  });

  describe('validateWithSchema', () => {
    it('should validate using inline schema', () => {
      const schema: JSONSchema = {
        type: 'object',
        required: ['id', 'value'],
        properties: {
          id: { type: 'string' },
          value: { type: 'number', minimum: 0, maximum: 100 }
        }
      };

      const validData = { id: 'test-1', value: 50 };
      const result1 = validator.validateWithSchema(validData, schema);
      expect(result1.valid).toBe(true);

      const invalidData = { id: 'test-2', value: 150 };
      const result2 = validator.validateWithSchema(invalidData, schema);
      expect(result2.valid).toBe(false);
    });
  });

  describe('validateVersionConstraint', () => {
    it('should validate min version constraint', () => {
      expect(validator.validateVersionConstraint('1.5.0', { minVersion: '1.0.0' })).toBe(true);
      expect(validator.validateVersionConstraint('0.9.0', { minVersion: '1.0.0' })).toBe(false);
    });

    it('should validate max version constraint', () => {
      expect(validator.validateVersionConstraint('1.5.0', { maxVersion: '2.0.0' })).toBe(true);
      expect(validator.validateVersionConstraint('2.1.0', { maxVersion: '2.0.0' })).toBe(false);
    });

    it('should validate compatible versions list', () => {
      const constraint = { compatibleVersions: ['1.0.0', '1.2.0', '2.0.0'] };
      expect(validator.validateVersionConstraint('1.2.0', constraint)).toBe(true);
      expect(validator.validateVersionConstraint('1.1.0', constraint)).toBe(false);
    });
  });

  describe('createInputOutputSchemaValidator', () => {
    it('should create input/output validators', () => {
      const inputSchema: JSONSchema = {
        type: 'object',
        required: ['inputData'],
        properties: {
          inputData: { type: 'string' }
        }
      };

      const outputSchema: JSONSchema = {
        type: 'object',
        required: ['result', 'score'],
        properties: {
          result: { type: 'string', enum: ['pass', 'fail'] },
          score: { type: 'number' }
        }
      };

      const { validateInput, validateOutput } = validator.createInputOutputSchemaValidator(
        inputSchema,
        outputSchema
      );

      const inputResult = validateInput({ inputData: 'test' });
      expect(inputResult.valid).toBe(true);

      const outputResult = validateOutput({ result: 'pass', score: 90 });
      expect(outputResult.valid).toBe(true);
    });
  });

  describe('validateQualityReport', () => {
    it('should validate quality report structure', () => {
      const validReport = {
        result: 'pass',
        score: 95,
        details: {
          defects: [],
          measurements: []
        }
      };

      const result = validator.validateQualityReport(validReport, []);
      expect(result.valid).toBe(true);

      const invalidReport = {
        result: 'invalid-status',
        score: 150,
        details: {}
      };

      const result2 = validator.validateQualityReport(invalidReport, []);
      expect(result2.valid).toBe(false);
    });

    it('should check additional expected fields', () => {
      const report = {
        result: 'pass',
        score: 95,
        details: {}
      };

      const result1 = validator.validateQualityReport(report, ['errors']);
      expect(result1.valid).toBe(false);

      const reportWithErrors = {
        result: 'pass',
        score: 95,
        details: {},
        errors: []
      };

      const result2 = validator.validateQualityReport(reportWithErrors, ['errors']);
      expect(result2.valid).toBe(true);
    });
  });

  describe('clear', () => {
    it('should clear all registered schemas', () => {
      const schema: JSONSchema = { type: 'string' };
      validator.registerSchema('test', schema);
      expect(validator.hasSchema('test')).toBe(true);

      validator.clear();
      expect(validator.hasSchema('test')).toBe(false);
    });
  });
});
