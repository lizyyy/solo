import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { ValidationResult } from '../types';

export class SchemaValidator {
  private ajv: Ajv;

  constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      verbose: true,
      strict: false
    });
    addFormats(this.ajv);
  }

  validate(schema: Record<string, unknown>, data: unknown): ValidationResult {
    try {
      const validate = this.ajv.compile(schema);
      const isValid = validate(data);

      const errors = (validate.errors || []).map((err) => ({
        keyword: err.keyword,
        instancePath: err.instancePath,
        schemaPath: err.schemaPath,
        message: err.message || '',
        params: err.params
      }));

      return {
        isValid: isValid as boolean,
        errors
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [{
          keyword: 'compilation',
          instancePath: '',
          schemaPath: '',
          message: `Schema编译错误: ${(error as Error).message}`,
          params: {}
        }]
      };
    }
  }

  isValidSchema(schema: Record<string, unknown>): boolean {
    try {
      this.ajv.compile(schema);
      return true;
    } catch {
      return false;
    }
  }
}

export const validator = new SchemaValidator();
