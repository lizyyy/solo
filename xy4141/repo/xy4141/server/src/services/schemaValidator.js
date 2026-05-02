const Ajv = require('ajv');

class SchemaValidator {
  constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      strict: false,
      useDefaults: true,
      coerceTypes: true
    });
  }

  validateInput(data, schema) {
    return this._validate(data, schema, 'input');
  }

  validateOutput(data, schema) {
    return this._validate(data, schema, 'output');
  }

  validateExpectedOutput(actual, expected, schema) {
    const schemaValidation = this.validateOutput(actual, schema);
    
    if (!schemaValidation.valid) {
      return schemaValidation;
    }
    
    const fieldComparison = this._compareFields(actual, expected);
    
    return {
      valid: fieldComparison.matches,
      errors: fieldComparison.matches ? [] : [{
        type: 'expected_mismatch',
        message: 'Output does not match expected result',
        details: fieldComparison.differences
      }],
      schemaValidation: schemaValidation,
      fieldComparison: fieldComparison
    };
  }

  _validate(data, schema, type) {
    if (!schema) {
      return {
        valid: true,
        errors: [],
        warning: 'No schema provided, skipping validation'
      };
    }

    try {
      const schemaObj = typeof schema === 'string' ? JSON.parse(schema) : schema;
      const validate = this.ajv.compile(schemaObj);
      const valid = validate(data);

      if (valid) {
        return {
          valid: true,
          errors: []
        };
      } else {
        return {
          valid: false,
          errors: validate.errors.map(error => ({
            type: 'schema_violation',
            path: error.instancePath || '/',
            message: error.message,
            params: error.params,
            schemaPath: error.schemaPath
          }))
        };
      }
    } catch (error) {
      return {
        valid: false,
        errors: [{
          type: 'schema_error',
          message: 'Invalid schema definition',
          details: error.message
        }]
      };
    }
  }

  _compareFields(actual, expected) {
    const differences = [];
    let matches = true;

    if (!expected || typeof expected !== 'object') {
      return {
        matches: true,
        differences: [],
        note: 'No expected output provided for comparison'
      };
    }

    if (!actual || typeof actual !== 'object') {
      return {
        matches: false,
        differences: [{
          field: '/',
          expected: expected,
          actual: actual,
          reason: 'Actual output is not an object'
        }]
      };
    }

    const expectedObj = typeof expected === 'string' ? JSON.parse(expected) : expected;
    const actualObj = typeof actual === 'string' ? JSON.parse(actual) : actual;

    const compare = (actualValue, expectedValue, path = '/') => {
      if (typeof expectedValue !== typeof actualValue) {
        differences.push({
          field: path,
          expected: expectedValue,
          actual: actualValue,
          reason: 'Type mismatch'
        });
        matches = false;
        return;
      }

      if (Array.isArray(expectedValue) && Array.isArray(actualValue)) {
        if (expectedValue.length !== actualValue.length) {
          differences.push({
            field: path,
            expected: `Array of length ${expectedValue.length}`,
            actual: `Array of length ${actualValue.length}`,
            reason: 'Array length mismatch'
          });
          matches = false;
          return;
        }
        
        expectedValue.forEach((item, index) => {
          compare(actualValue[index], item, `${path}[${index}]`);
        });
        return;
      }

      if (typeof expectedValue === 'object' && expectedValue !== null) {
        const expectedKeys = Object.keys(expectedValue);
        const actualKeys = Object.keys(actualValue);

        expectedKeys.forEach(key => {
          if (!actualKeys.includes(key)) {
            differences.push({
              field: `${path}/${key}`,
              expected: expectedValue[key],
              actual: undefined,
              reason: 'Missing field'
            });
            matches = false;
          } else {
            compare(actualValue[key], expectedValue[key], `${path}/${key}`);
          }
        });
      } else {
        if (actualValue !== expectedValue) {
          differences.push({
            field: path,
            expected: expectedValue,
            actual: actualValue,
            reason: 'Value mismatch'
          });
          matches = false;
        }
      }
    };

    compare(actualObj, expectedObj);

    return {
      matches,
      differences
    };
  }

  validateManifest(manifest) {
    const requiredFields = ['name', 'version', 'entrypoint'];
    const missing = requiredFields.filter(field => !manifest[field]);
    
    if (missing.length > 0) {
      return {
        valid: false,
        errors: missing.map(field => ({
          type: 'missing_field',
          field,
          message: `Missing required manifest field: ${field}`
        }))
      };
    }

    const errors = [];

    if (manifest.dependencies && !Array.isArray(manifest.dependencies)) {
      errors.push({
        type: 'invalid_type',
        field: 'dependencies',
        message: 'dependencies must be an array'
      });
    }

    if (manifest.permissions && !Array.isArray(manifest.permissions)) {
      errors.push({
        type: 'invalid_type',
        field: 'permissions',
        message: 'permissions must be an array'
      });
    }

    const allowedPermissions = ['read:local', 'write:local', 'network:outbound'];
    if (manifest.permissions && Array.isArray(manifest.permissions)) {
      manifest.permissions.forEach(perm => {
        if (!allowedPermissions.includes(perm)) {
          errors.push({
            type: 'invalid_permission',
            permission: perm,
            message: `Invalid permission: ${perm}. Allowed: ${allowedPermissions.join(', ')}`
          });
        }
      });
    }

    if (manifest.error_codes && !Array.isArray(manifest.error_codes)) {
      errors.push({
        type: 'invalid_type',
        field: 'error_codes',
        message: 'error_codes must be an array'
      });
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = new SchemaValidator();
