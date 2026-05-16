import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { cloneDeep } from 'lodash';
import { OpenAPISchema, PerturbedSample, ValidationResult, ValidationError } from '../types';

export class Validator {
  private ajv: Ajv;
  private openapiDoc: OpenAPISchema;

  constructor(openapiDoc: OpenAPISchema) {
    this.openapiDoc = openapiDoc;
    this.ajv = new Ajv({
      strict: false,
      allErrors: true,
      verbose: true,
      discriminator: true,
      logger: false,
    });
    addFormats(this.ajv);
    this.registerSchemas();
  }

  private registerSchemas(): void {
    if (this.openapiDoc.components?.schemas) {
      for (const [schemaName, schema] of Object.entries(this.openapiDoc.components.schemas)) {
        this.ajv.addSchema(schema, `#/components/schemas/${schemaName}`);
      }
    }
  }

  public validateAll(
    samples: PerturbedSample[],
    failFast: boolean = false
  ): ValidationResult[] {
    const results: ValidationResult[] = [];

    for (const sample of samples) {
      const result = this.validate(sample);
      results.push(result);

      if (failFast && !result.valid) {
        break;
      }
    }

    return results;
  }

  public validate(sample: PerturbedSample): ValidationResult {
    const startTime = Date.now();
    const schema = this.extractSchemaFromLocation(sample.original.schemaPath);
    const validate = this.ajv.compile(schema);
    const valid = validate(sample.perturbedValue);
    const durationMs = Date.now() - startTime;

    const errors: ValidationError[] = validate.errors
      ? validate.errors.map(err => ({
          instancePath: err.instancePath || '',
          schemaPath: err.schemaPath || '',
          keyword: err.keyword,
          message: err.message,
          params: err.params,
        }))
      : [];

    return {
      valid,
      errors,
      sample,
      durationMs,
    };
  }

  private extractSchemaFromLocation(jsonPath: string): any {
    const parts = jsonPath.split('.').filter(p => p !== '$' && p !== '');
    let current: any = this.openapiDoc;

    for (const part of parts) {
      if (current[part] === undefined) {
        if (current.properties && current.properties[part]) {
          current = current.properties[part];
          continue;
        }
        break;
      }
      current = current[part];
    }

    if (current?.schema) {
      return current.schema;
    }

    if (current?.properties || current?.type) {
      return current;
    }

    return { type: 'object' };
  }

  public getErrorExplanation(error: ValidationError): string {
    const explanations: Record<string, (err: ValidationError) => string> = {
      type: err => `Expected type "${err.params.type}" but got "${typeof err.params.type}"`,
      required: err => `Missing required field: "${err.params.missingProperty}"`,
      additionalProperties: err => `Unexpected property: "${err.params.additionalProperty}"`,
      minLength: err => `String is too short (minimum length: ${err.params.limit})`,
      maxLength: err => `String is too long (maximum length: ${err.params.limit})`,
      minimum: err => `Value is too low (minimum: ${err.params.limit})`,
      maximum: err => `Value is too high (maximum: ${err.params.limit})`,
      pattern: err => `String does not match pattern: "${err.params.pattern}"`,
      enum: err => `Value must be one of: ${err.params.allowedValues.join(', ')}`,
      format: err => `Value does not match format: "${err.params.format}"`,
      minItems: err => `Array has too few items (minimum: ${err.params.limit})`,
      maxItems: err => `Array has too many items (maximum: ${err.params.limit})`,
      uniqueItems: err => `Array has duplicate items`,
      minProperties: err => `Object has too few properties (minimum: ${err.params.limit})`,
      maxProperties: err => `Object has too many properties (maximum: ${err.params.limit})`,
      nullable: err => `Value cannot be null`,
    };

    const explainFn = explanations[error.keyword];
    return explainFn ? explainFn(error) : error.message || `Validation failed for keyword: ${error.keyword}`;
  }
}
