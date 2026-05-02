import Ajv, { JSONSchemaType, ValidateFunction } from 'ajv';
import {
  JSONSchema,
  SchemaValidationResult,
  SchemaError,
  SchemaWarning,
  VersionConstraint,
  VersionCompatibilityResult
} from '../types';
import { createLogger } from '../utils/logger';
import { SchemaValidationError, errorToRecord } from '../utils/error';
import { checkVersionCompatibility, parseSemver } from '../utils/version';

const logger = createLogger('schema-validator');

export interface SchemaValidatorOptions {
  strictMode?: boolean;
  validateFormats?: boolean;
  allowAdditionalProperties?: boolean;
  customFormats?: Record<string, (value: string) => boolean>;
}

const DEFAULT_OPTIONS: Required<SchemaValidatorOptions> = {
  strictMode: true,
  validateFormats: true,
  allowAdditionalProperties: false,
  customFormats: {}
};

export class SchemaValidator {
  private ajv: Ajv;
  private options: Required<SchemaValidatorOptions>;
  private schemas: Map<string, JSONSchema> = new Map();
  private validators: Map<string, ValidateFunction> = new Map();

  constructor(options?: SchemaValidatorOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.ajv = new Ajv({
      strict: this.options.strictMode,
      allErrors: true,
      verbose: true,
      formats: {
        ...this.options.customFormats
      }
    });

    this.registerCommonFormats();
  }

  private registerCommonFormats(): void {
    if (this.options.validateFormats) {
      this.ajv.addFormat('uuid', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      this.ajv.addFormat('iso-date', /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/);
      this.ajv.addFormat('semver', {
        validate: (x: string) => {
          try {
            parseSemver(x);
            return true;
          } catch {
            return false;
          }
        }
      });
    }
  }

  registerSchema(id: string, schema: JSONSchema): void {
    logger.info(`Registering schema: ${id}`);

    try {
      this.schemas.set(id, schema);

      const processedSchema = this.processSchema(schema);
      const validate = this.ajv.compile(processedSchema);
      this.validators.set(id, validate);

      logger.debug(`Schema registered successfully: ${id}`);
    } catch (error) {
      throw new SchemaValidationError(`Failed to register schema: ${id}`, {
        error: errorToRecord(error)
      });
    }
  }

  getSchema(id: string): JSONSchema | undefined {
    return this.schemas.get(id);
  }

  hasSchema(id: string): boolean {
    return this.schemas.has(id);
  }

  validate(data: unknown, schemaId: string): SchemaValidationResult {
    const startTime = Date.now();

    const validator = this.validators.get(schemaId);
    if (!validator) {
      return {
        valid: false,
        errors: [
          {
            path: '',
            keyword: 'missing_schema',
            message: `Schema "${schemaId}" is not registered`,
            params: { schemaId }
          }
        ],
        warnings: [],
        schemaId,
        validatedAt: Date.now()
      };
    }

    const valid = validator(data);
    const duration = Date.now() - startTime;

    logger.debug(`Validation completed in ${duration}ms, result: ${valid ? 'valid' : 'invalid'}`);

    if (valid) {
      return {
        valid: true,
        errors: [],
        warnings: this.collectWarnings(validator),
        schemaId,
        validatedAt: Date.now()
      };
    }

    const errors: SchemaError[] = (validator.errors || []).map(err => ({
      path: err.instancePath || '',
      keyword: err.keyword,
      message: err.message || 'Validation error',
      expected: err.params,
      actual: undefined,
      params: err.params
    }));

    return {
      valid: false,
      errors,
      warnings: this.collectWarnings(validator),
      schemaId,
      validatedAt: Date.now()
    };
  }

  validateWithSchema(data: unknown, schema: JSONSchema): SchemaValidationResult {
    const startTime = Date.now();

    try {
      const processedSchema = this.processSchema(schema);
      const validator = this.ajv.compile(processedSchema);
      const valid = validator(data);
      const duration = Date.now() - startTime;

      logger.debug(`Inline validation completed in ${duration}ms, result: ${valid ? 'valid' : 'invalid'}`);

      if (valid) {
        return {
          valid: true,
          errors: [],
          warnings: this.collectWarnings(validator),
          schemaId: 'inline',
          validatedAt: Date.now()
        };
      }

      const errors: SchemaError[] = (validator.errors || []).map(err => ({
        path: err.instancePath || '',
        keyword: err.keyword,
        message: err.message || 'Validation error',
        expected: err.params,
        actual: undefined,
        params: err.params
      }));

      return {
        valid: false,
        errors,
        warnings: this.collectWarnings(validator),
        schemaId: 'inline',
        validatedAt: Date.now()
      };
    } catch (error) {
      throw new SchemaValidationError('Failed to compile or validate with inline schema', {
        error: errorToRecord(error)
      });
    }
  }

  validateVersionCompatibility(
    pluginVersion: string,
    systemVersion: string,
    constraint?: VersionConstraint
  ): VersionCompatibilityResult {
    return checkVersionCompatibility(pluginVersion, systemVersion, constraint);
  }

  validateVersionConstraint(version: string, constraint: VersionConstraint): boolean {
    try {
      if (constraint.compatibleVersions && constraint.compatibleVersions.length > 0) {
        return constraint.compatibleVersions.some(v => v === version);
      }

      if (constraint.minVersion) {
        if (this.compareVersions(version, constraint.minVersion) < 0) {
          return false;
        }
      }

      if (constraint.maxVersion) {
        if (this.compareVersions(version, constraint.maxVersion) > 0) {
          return false;
        }
      }

      return true;
    } catch (error) {
      logger.warn(`Version constraint validation failed: ${(error as Error).message}`);
      return false;
    }
  }

  private compareVersions(a: string, b: string): number {
    try {
      const parsedA = parseSemver(a);
      const parsedB = parseSemver(b);

      if (parsedA.major !== parsedB.major) {
        return parsedA.major - parsedB.major;
      }

      if (parsedA.minor !== parsedB.minor) {
        return parsedA.minor - parsedB.minor;
      }

      if (parsedA.patch !== parsedB.patch) {
        return parsedA.patch - parsedB.patch;
      }

      if (parsedA.prerelease && !parsedB.prerelease) {
        return -1;
      }

      if (!parsedA.prerelease && parsedB.prerelease) {
        return 1;
      }

      return 0;
    } catch {
      return a.localeCompare(b);
    }
  }

  private processSchema(schema: JSONSchema): JSONSchema {
    if (!this.options.allowAdditionalProperties) {
      return this.enforceNoAdditionalProperties({ ...schema });
    }
    return schema;
  }

  private enforceNoAdditionalProperties(schema: JSONSchema): JSONSchema {
    const result = { ...schema };

    if (result.type === 'object' && result.properties) {
      if (result.additionalProperties === undefined) {
        result.additionalProperties = false;
      }

      for (const [key, value] of Object.entries(result.properties)) {
        if (value && typeof value === 'object') {
          result.properties[key] = this.enforceNoAdditionalProperties(value as JSONSchema);
        }
      }
    }

    if (result.type === 'array' && result.items) {
      if (Array.isArray(result.items)) {
        result.items = result.items.map(item =>
          this.enforceNoAdditionalProperties(item as JSONSchema)
        );
      } else {
        result.items = this.enforceNoAdditionalProperties(result.items as JSONSchema);
      }
    }

    if (result.$defs) {
      const newDefs: Record<string, JSONSchema> = {};
      for (const [key, value] of Object.entries(result.$defs)) {
        newDefs[key] = this.enforceNoAdditionalProperties(value);
      }
      result.$defs = newDefs;
    }

    return result;
  }

  private collectWarnings(validator: ValidateFunction): SchemaWarning[] {
    const warnings: SchemaWarning[] = [];

    if (validator.errors) {
      for (const error of validator.errors) {
        if (error.keyword === 'format') {
          warnings.push({
            path: error.instancePath || '',
            message: `Format warning: ${error.message}`,
            level: 'warning'
          });
        }
      }
    }

    return warnings;
  }

  createInputOutputSchemaValidator(
    inputSchema: JSONSchema,
    outputSchema: JSONSchema
  ): {
    validateInput: (data: unknown) => SchemaValidationResult;
    validateOutput: (data: unknown) => SchemaValidationResult;
  } {
    const inputSchemaId = 'input_' + Date.now();
    const outputSchemaId = 'output_' + (Date.now() + 1);

    this.registerSchema(inputSchemaId, inputSchema);
    this.registerSchema(outputSchemaId, outputSchema);

    return {
      validateInput: (data: unknown) => this.validate(data, inputSchemaId),
      validateOutput: (data: unknown) => this.validate(data, outputSchemaId)
    };
  }

  validateQualityReport(
    report: unknown,
    expectedFields: string[]
  ): SchemaValidationResult {
    const qualityReportSchema: JSONSchema = {
      type: 'object',
      required: ['result', 'score', 'details'],
      additionalProperties: true,
      properties: {
        result: { type: 'string', enum: ['pass', 'fail', 'warning', 'error'] },
        score: { type: 'number', minimum: 0, maximum: 100 },
        details: {
          type: 'object',
          additionalProperties: true
        },
        errors: {
          type: 'array',
          items: {
            type: 'object',
            required: ['code', 'message'],
            additionalProperties: true,
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] }
            }
          }
        },
        measurements: {
          type: 'array',
          items: {
            type: 'object',
            required: ['name', 'value'],
            additionalProperties: true,
            properties: {
              name: { type: 'string' },
              value: { anyOf: [{ type: 'number' }, { type: 'string' }, { type: 'boolean' }] },
              unit: { type: 'string' },
              tolerance: { type: 'number' }
            }
          }
        },
        metadata: {
          type: 'object',
          additionalProperties: true
        }
      }
    };

    if (expectedFields.length > 0) {
      qualityReportSchema.required = [
        ...(qualityReportSchema.required as string[]),
        ...expectedFields
      ];
    }

    return this.validateWithSchema(report, qualityReportSchema);
  }

  clear(): void {
    this.schemas.clear();
    this.validators.clear();
    logger.info('Schema validator cache cleared');
  }
}

export function createSchemaValidator(options?: SchemaValidatorOptions): SchemaValidator {
  return new SchemaValidator(options);
}
