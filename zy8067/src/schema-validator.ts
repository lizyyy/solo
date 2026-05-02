import Ajv from 'ajv';
import { HookDefinition } from './types.js';

export class SchemaValidator {
  private ajv: Ajv;

  constructor() {
    this.ajv = new Ajv({ strict: false });
  }

  validateInput(hook: HookDefinition, input: any): { valid: boolean; errors?: string[] } {
    return this.validate(hook.inputSchema, input);
  }

  validateOutput(hook: HookDefinition, output: any): { valid: boolean; errors?: string[] } {
    return this.validate(hook.outputSchema, output);
  }

  private validate(schema: Record<string, any>, data: any): { valid: boolean; errors?: string[] } {
    const validate = this.ajv.compile(schema);
    const valid = validate(data);
    
    if (!valid && validate.errors) {
      return {
        valid: false,
        errors: validate.errors.map(e => `${e.instancePath} ${e.message}`)
      };
    }
    
    return { valid: true };
  }
}