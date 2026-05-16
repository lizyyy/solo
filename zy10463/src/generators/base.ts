import { JSONSchemaFaker } from 'json-schema-faker';
import { seededRandom } from '../utils/helpers';

export abstract class BaseGenerator {
  protected schema: Record<string, unknown>;
  protected seed: number;
  protected random: () => number;

  constructor(schema: Record<string, unknown>, seed: number) {
    this.schema = schema;
    this.seed = seed;
    this.random = seededRandom(seed);
  }

  protected generateValid(): unknown {
    JSONSchemaFaker.option({
      random: this.random,
      useDefaultValue: true,
      useExamplesValue: true,
      failOnInvalidTypes: false,
      alwaysFakeOptionals: true
    });
    return JSONSchemaFaker.generate(this.schema);
  }

  protected getPropertyAtPath(obj: Record<string, unknown>, path: string): {
    parent: Record<string, unknown>;
    key: string;
    value: unknown;
  } | null {
    const parts = path.split('.').filter(Boolean);
    let current: Record<string, unknown> = obj;
    let parent: Record<string, unknown> | null = null;
    let lastKey = '';

    for (const part of parts) {
      if (current && typeof current === 'object') {
        parent = current;
        lastKey = part;
        current = current[part] as Record<string, unknown>;
      } else {
        return null;
      }
    }

    return {
      parent: parent as Record<string, unknown>,
      key: lastKey,
      value: current
    };
  }

  protected setPropertyAtPath(obj: Record<string, unknown>, path: string, value: unknown): void {
    const parts = path.split('.').filter(Boolean);
    let current: Record<string, unknown> = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part]) {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }

    current[parts[parts.length - 1]] = value;
  }

  abstract generate(index: number, fieldPath?: string): {
    data: unknown;
    reason: string;
  };
}
