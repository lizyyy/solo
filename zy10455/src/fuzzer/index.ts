import * as fs from 'fs';
import { cloneDeep, shuffle, sortBy } from 'lodash';
import { JSONPath } from 'jsonpath-plus';
import {
  FuzzRule,
  SchemaWithLocation,
  OriginalSample,
  PerturbedSample,
  CoverageStats,
} from '../types';

const DEFAULT_RULES: FuzzRule[] = [
  {
    id: 'null-value',
    name: 'Replace with null',
    description: 'Replace non-null values with null to test nullability',
    enabled: true,
    type: 'null',
    priority: 100,
  },
  {
    id: 'empty-string',
    name: 'Replace with empty string',
    description: 'Replace string values with empty strings',
    enabled: true,
    type: 'empty-string',
    priority: 90,
  },
  {
    id: 'array-shuffle',
    name: 'Shuffle array items',
    description: 'Randomly shuffle array items to test order sensitivity',
    enabled: true,
    type: 'array-shuffle',
    priority: 80,
  },
  {
    id: 'array-reverse',
    name: 'Reverse array',
    description: 'Reverse the order of array items',
    enabled: true,
    type: 'array-reverse',
    priority: 75,
  },
  {
    id: 'array-sort',
    name: 'Sort array',
    description: 'Sort array items alphabetically',
    enabled: true,
    type: 'array-sort',
    priority: 70,
  },
  {
    id: 'missing-field',
    name: 'Remove required field',
    description: 'Remove required fields from objects',
    enabled: true,
    type: 'missing-field',
    priority: 60,
  },
  {
    id: 'extra-field',
    name: 'Add extra field',
    description: 'Add unexpected fields to objects',
    enabled: true,
    type: 'extra-field',
    priority: 50,
  },
];

export class Fuzzer {
  private rules: FuzzRule[];
  private coverageStats: CoverageStats;
  private sampleIdCounter: number;

  constructor(rulesFile?: string) {
    this.rules = rulesFile ? this.loadRules(rulesFile) : [...DEFAULT_RULES];
    this.sampleIdCounter = 0;
    this.coverageStats = {
      totalRules: this.rules.filter(r => r.enabled).length,
      appliedRules: 0,
      totalSamples: 0,
      perturbedSamples: 0,
      schemaPathsCovered: [],
      ruleCoverage: {},
    };

    this.rules.forEach(rule => {
      this.coverageStats.ruleCoverage[rule.id] = 0;
    });
  }

  private loadRules(filePath: string): FuzzRule[] {
    const content = fs.readFileSync(filePath, 'utf-8');
    const rules = JSON.parse(content);
    return Array.isArray(rules) ? rules : [rules];
  }

  public getRules(): FuzzRule[] {
    return cloneDeep(this.rules);
  }

  public getCoverageStats(): CoverageStats {
    return cloneDeep(this.coverageStats);
  }

  public generatePerturbations(schemas: SchemaWithLocation[]): PerturbedSample[] {
    const results: PerturbedSample[] = [];
    const enabledRules = this.rules.filter(r => r.enabled);

    for (const schemaWithLoc of schemas) {
      const samples = this.extractSamples(schemaWithLoc);
      this.coverageStats.totalSamples += samples.length;

      for (const sample of samples) {
        for (const rule of enabledRules) {
          const perturbation = this.applyRule(sample, rule, schemaWithLoc.schema);
          if (perturbation) {
            results.push(perturbation);
            this.coverageStats.perturbedSamples++;
            this.coverageStats.ruleCoverage[rule.id]++;

            if (!this.coverageStats.schemaPathsCovered.includes(sample.location.jsonPath)) {
              this.coverageStats.schemaPathsCovered.push(sample.location.jsonPath);
            }
          }
        }
      }
    }

    this.coverageStats.appliedRules = Object.values(this.coverageStats.ruleCoverage).filter(
      v => v > 0
    ).length;

    return results;
  }

  private extractSamples(schemaWithLoc: SchemaWithLocation): OriginalSample[] {
    const samples: OriginalSample[] = [];

    if (schemaWithLoc.example !== undefined) {
      samples.push({
        value: cloneDeep(schemaWithLoc.example),
        location: schemaWithLoc.location,
        schemaPath: schemaWithLoc.location.jsonPath,
      });
    }

    if (schemaWithLoc.examples) {
      for (const [exampleName, example] of Object.entries(schemaWithLoc.examples)) {
        const value = (example as any).value ?? example;
        samples.push({
          value: cloneDeep(value),
          location: {
            ...schemaWithLoc.location,
            jsonPath: `${schemaWithLoc.location.jsonPath}.examples.${exampleName}`,
          },
          schemaPath: schemaWithLoc.location.jsonPath,
        });
      }
    }

    return samples;
  }

  private applyRule(
    sample: OriginalSample,
    rule: FuzzRule,
    schema: any
  ): PerturbedSample | null {
    const value = sample.value;
    let perturbedValue: any;
    let description = '';

    switch (rule.type) {
      case 'null':
        if (value !== null && value !== undefined) {
          perturbedValue = null;
          description = `Replaced value with null`;
        }
        break;

      case 'empty-string':
        if (typeof value === 'string' && value !== '') {
          perturbedValue = '';
          description = `Replaced string with empty string`;
        }
        break;

      case 'array-shuffle':
        if (Array.isArray(value) && value.length > 1) {
          perturbedValue = shuffle([...value]);
          description = `Shuffled array items`;
        }
        break;

      case 'array-reverse':
        if (Array.isArray(value) && value.length > 1) {
          perturbedValue = [...value].reverse();
          description = `Reversed array order`;
        }
        break;

      case 'array-sort':
        if (Array.isArray(value) && value.length > 1) {
          perturbedValue = sortBy([...value]);
          description = `Sorted array items alphabetically`;
        }
        break;

      case 'missing-field':
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          const required = schema?.required || [];
          const keys = Object.keys(value);
          const keyToRemove = required.find((k: string) => keys.includes(k)) || keys[0];
          if (keyToRemove) {
            perturbedValue = cloneDeep(value);
            delete perturbedValue[keyToRemove];
            description = `Removed field: ${keyToRemove}`;
          }
        }
        break;

      case 'extra-field':
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          perturbedValue = cloneDeep(value);
          perturbedValue.__extra_fuzz_field__ = 'unexpected_value';
          description = `Added unexpected field`;
        }
        break;
    }

    if (perturbedValue === undefined) {
      return null;
    }

    return {
      id: `fuzz-${++this.sampleIdCounter}`,
      original: sample,
      perturbedValue,
      ruleId: rule.id,
      ruleName: rule.name,
      perturbationDescription: description,
    };
  }
}
