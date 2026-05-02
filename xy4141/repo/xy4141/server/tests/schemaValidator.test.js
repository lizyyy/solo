const schemaValidator = require('../src/services/schemaValidator');

describe('SchemaValidator', () => {
  describe('validateManifest', () => {
    test('should validate a valid manifest', () => {
      const manifest = {
        name: 'quality-check-rule',
        version: '1.0.0',
        entrypoint: 'process',
        vendor: 'FactoryTech Solutions',
        description: 'Product quality inspection rule'
      };

      const result = schemaValidator.validateManifest(manifest);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject manifest missing required fields', () => {
      const manifest = {
        name: 'quality-check-rule'
      };

      const result = schemaValidator.validateManifest(manifest);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].type).toBe('missing_field');
    });

    test('should reject manifest with invalid permissions', () => {
      const manifest = {
        name: 'quality-check-rule',
        version: '1.0.0',
        entrypoint: 'process',
        permissions: ['network:outbound', 'write:local', 'dangerous:access']
      };

      const result = schemaValidator.validateManifest(manifest);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'invalid_permission')).toBe(true);
    });

    test('should reject manifest with non-array dependencies', () => {
      const manifest = {
        name: 'quality-check-rule',
        version: '1.0.0',
        entrypoint: 'process',
        dependencies: 'not an array'
      };

      const result = schemaValidator.validateManifest(manifest);
      expect(result.valid).toBe(false);
      expect(result.errors[0].type).toBe('invalid_type');
    });
  });

  describe('validateInput', () => {
    const inputSchema = {
      type: 'object',
      required: ['product_id', 'dimensions', 'inspection_time'],
      properties: {
        product_id: { type: 'string' },
        dimensions: {
          type: 'object',
          required: ['length', 'width', 'height'],
          properties: {
            length: { type: 'number', minimum: 0 },
            width: { type: 'number', minimum: 0 },
            height: { type: 'number', minimum: 0 }
          }
        },
        inspection_time: { type: 'string', format: 'date-time' },
        sensor_readings: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              sensor_id: { type: 'string' },
              value: { type: 'number' }
            }
          }
        }
      }
    };

    test('should validate input against schema', () => {
      const validInput = {
        product_id: 'PRD-2024-001',
        dimensions: {
          length: 100.5,
          width: 50.2,
          height: 25.0
        },
        inspection_time: '2024-05-15T10:30:00Z',
        sensor_readings: [
          { sensor_id: 'temp-001', value: 23.5 },
          { sensor_id: 'pressure-002', value: 1.2 }
        ]
      };

      const result = schemaValidator.validateInput(validInput, inputSchema);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject invalid input', () => {
      const invalidInput = {
        product_id: 'PRD-2024-001',
        dimensions: {
          length: 'not a number',
          width: 50.2
        }
      };

      const result = schemaValidator.validateInput(invalidInput, inputSchema);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should return valid when no schema provided', () => {
      const input = { any: 'data' };
      const result = schemaValidator.validateInput(input, null);
      expect(result.valid).toBe(true);
      expect(result.warning).toBeDefined();
    });
  });

  describe('_compareFields', () => {
    test('should detect exact match', () => {
      const actual = {
        passed: true,
        quality_score: 95.5,
        defects: [],
        recommendations: {
          action: 'accept',
          notes: 'No issues detected'
        }
      };

      const expected = {
        passed: true,
        quality_score: 95.5,
        defects: [],
        recommendations: {
          action: 'accept',
          notes: 'No issues detected'
        }
      };

      const result = schemaValidator._compareFields(actual, expected);
      expect(result.matches).toBe(true);
      expect(result.differences).toHaveLength(0);
    });

    test('should detect type mismatch', () => {
      const actual = { score: '95' };
      const expected = { score: 95 };

      const result = schemaValidator._compareFields(actual, expected);
      expect(result.matches).toBe(false);
      expect(result.differences[0].reason).toBe('Type mismatch');
    });

    test('should detect value mismatch', () => {
      const actual = { passed: true, score: 90 };
      const expected = { passed: false, score: 90 };

      const result = schemaValidator._compareFields(actual, expected);
      expect(result.matches).toBe(false);
      expect(result.differences[0].reason).toBe('Value mismatch');
    });

    test('should detect missing fields', () => {
      const actual = { passed: true };
      const expected = { passed: true, score: 95, defects: [] };

      const result = schemaValidator._compareFields(actual, expected);
      expect(result.matches).toBe(false);
      expect(result.differences.some(d => d.reason === 'Missing field')).toBe(true);
    });

    test('should detect array length mismatch', () => {
      const actual = { defects: [{ code: 'D001' }] };
      const expected = { defects: [{ code: 'D001' }, { code: 'D002' }] };

      const result = schemaValidator._compareFields(actual, expected);
      expect(result.matches).toBe(false);
      expect(result.differences[0].reason).toBe('Array length mismatch');
    });

    test('should return match when no expected output', () => {
      const actual = { any: 'data' };
      const result = schemaValidator._compareFields(actual, null);
      expect(result.matches).toBe(true);
    });
  });

  describe('validateExpectedOutput', () => {
    const outputSchema = {
      type: 'object',
      required: ['passed', 'quality_score'],
      properties: {
        passed: { type: 'boolean' },
        quality_score: { type: 'number', minimum: 0, maximum: 100 },
        defects: { type: 'array' }
      }
    };

    test('should validate output against schema and expected value', () => {
      const actual = {
        passed: true,
        quality_score: 95.5,
        defects: []
      };

      const expected = {
        passed: true,
        quality_score: 95.5,
        defects: []
      };

      const result = schemaValidator.validateExpectedOutput(actual, expected, outputSchema);
      expect(result.valid).toBe(true);
    });

    test('should reject output that fails schema', () => {
      const actual = {
        passed: 'true',
        quality_score: 'invalid'
      };

      const expected = {
        passed: true,
        quality_score: 95
      };

      const result = schemaValidator.validateExpectedOutput(actual, expected, outputSchema);
      expect(result.valid).toBe(false);
    });

    test('should reject output that matches schema but not expected', () => {
      const actual = {
        passed: false,
        quality_score: 45.0,
        defects: [{ code: 'D001', severity: 'high' }]
      };

      const expected = {
        passed: true,
        quality_score: 95.0,
        defects: []
      };

      const result = schemaValidator.validateExpectedOutput(actual, expected, outputSchema);
      expect(result.valid).toBe(false);
      expect(result.schemaValidation?.valid).toBe(true);
    });
  });
});
