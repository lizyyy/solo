import * as _ from 'lodash';
import {
  ApiContract,
  EndpointSchema,
  FieldSchema,
  FieldDiff,
  EndpointDiff,
  ContractDiffResult,
  DiffType,
  DiffSeverity,
  CompatibilityCheckOptions
} from './types';

export class ContractComparator {
  private options: CompatibilityCheckOptions;

  constructor(options?: Partial<CompatibilityCheckOptions>) {
    this.options = {
      allowNewOptionalFields: true,
      allowNewEnumValues: true,
      allowNewEndpoints: true,
      allowNewResponseCodes: true,
      ...options
    };
  }

  compare(contractA: ApiContract, contractB: ApiContract): ContractDiffResult {
    const endpointDiffs: EndpointDiff[] = [];
    const missingEndpoints: EndpointSchema[] = [];
    const newEndpoints: EndpointSchema[] = [];

    const endpointsA = new Map(contractA.endpoints.map(e => [`${e.method}:${e.path}`, e]));
    const endpointsB = new Map(contractB.endpoints.map(e => [`${e.method}:${e.path}`, e]));

    for (const [key, endpointA] of endpointsA) {
      const endpointB = endpointsB.get(key);
      if (endpointB) {
        const diff = this.compareEndpoints(endpointA, endpointB);
        if (diff.fieldDiffs.length > 0 || diff.type) {
          endpointDiffs.push(diff);
        }
      } else {
        missingEndpoints.push(endpointA);
      }
    }

    for (const [key, endpointB] of endpointsB) {
      if (!endpointsA.has(key)) {
        newEndpoints.push(endpointB);
      }
    }

    const breakingChanges = endpointDiffs.filter(d => 
      d.severity === 'breaking' || d.fieldDiffs.some(f => f.severity === 'breaking')
    ).length + missingEndpoints.length;

    const warnings = endpointDiffs.filter(d => 
      d.severity === 'warning' || d.fieldDiffs.some(f => f.severity === 'warning')
    ).length;

    const infos = endpointDiffs.filter(d => 
      d.severity === 'info' || d.fieldDiffs.some(f => f.severity === 'info')
    ).length;

    return {
      contractA,
      contractB,
      timestamp: new Date().toISOString(),
      summary: {
        totalDiffs: endpointDiffs.length + missingEndpoints.length + newEndpoints.length,
        breakingChanges,
        warnings,
        infos,
        isCompatible: breakingChanges === 0
      },
      endpointDiffs,
      missingEndpoints,
      newEndpoints
    };
  }

  private compareEndpoints(a: EndpointSchema, b: EndpointSchema): EndpointDiff {
    const fieldDiffs: FieldDiff[] = [];

    for (const [statusCode, responseA] of Object.entries(a.responses)) {
      const responseB = b.responses[statusCode];
      if (responseB) {
        const diffs = this.compareFieldSchemas(
          responseA, 
          responseB, 
          `response.${statusCode}`,
          a.path
        );
        fieldDiffs.push(...diffs);
      } else if (!this.options.allowNewResponseCodes) {
        fieldDiffs.push({
          type: 'response_code_removed',
          path: a.path,
          field: `response.${statusCode}`,
          severity: 'warning',
          source: { context: `Endpoint ${a.method} ${a.path}` }
        });
      }
    }

    for (const statusCode of Object.keys(b.responses)) {
      if (!a.responses[statusCode]) {
        fieldDiffs.push({
          type: 'response_code_added',
          path: a.path,
          field: `response.${statusCode}`,
          severity: this.options.allowNewResponseCodes ? 'info' : 'warning',
          source: { context: `Endpoint ${a.method} ${a.path}` }
        });
      }
    }

    if (a.requestBody && b.requestBody) {
      const diffs = this.compareFieldSchemas(
        a.requestBody,
        b.requestBody,
        'requestBody',
        a.path
      );
      fieldDiffs.push(...diffs);
    }

    const paramsA = new Map(a.parameters?.map(p => [p.name, p]));
    const paramsB = new Map(b.parameters?.map(p => [p.name, p]));

    for (const [name, paramA] of paramsA) {
      const paramB = paramsB.get(name);
      if (paramB) {
        if (paramA.type !== paramB.type) {
          fieldDiffs.push({
            type: 'type_changed',
            path: a.path,
            field: `param.${name}`,
            expected: paramA.type,
            actual: paramB.type,
            severity: 'breaking',
            source: { context: `Parameter ${name}` }
          });
        }
        if (paramA.required !== paramB.required && !paramA.required) {
          fieldDiffs.push({
            type: 'required_changed',
            path: a.path,
            field: `param.${name}`,
            expected: paramA.required,
            actual: paramB.required,
            severity: 'breaking',
            source: { context: `Parameter ${name} became required` }
          });
        }
      } else {
        fieldDiffs.push({
          type: 'parameter_removed',
          path: a.path,
          field: `param.${name}`,
          severity: paramA.required ? 'breaking' : 'warning',
          source: { context: `Required parameter ${name} is missing` }
        });
      }
    }

    for (const [name, paramB] of paramsB) {
      if (!paramsA.has(name)) {
        fieldDiffs.push({
          type: 'parameter_added',
          path: a.path,
          field: `param.${name}`,
          severity: paramB.required ? 'breaking' : 'info',
          source: { context: `New parameter ${name} added` }
        });
      }
    }

    const hasBreaking = fieldDiffs.some(d => d.severity === 'breaking');
    const hasWarning = fieldDiffs.some(d => d.severity === 'warning');

    return {
      path: a.path,
      method: a.method,
      type: hasBreaking ? 'type_changed' : undefined,
      severity: hasBreaking ? 'breaking' : hasWarning ? 'warning' : 'info',
      fieldDiffs
    };
  }

  private compareFieldSchemas(
    a: FieldSchema,
    b: FieldSchema,
    path: string,
    endpointPath: string
  ): FieldDiff[] {
    const diffs: FieldDiff[] = [];
    const fullPath = path ? `${path}.${a.name}` : a.name;

    if (a.type !== b.type && a.type !== 'null' && b.type !== 'null') {
      if (!(a.type === 'integer' && b.type === 'number')) {
        diffs.push({
          type: 'type_changed',
          path: endpointPath,
          field: fullPath,
          expected: a.type,
          actual: b.type,
          severity: 'breaking',
          source: { context: `Type mismatch at ${fullPath}` }
        });
      }
    }

    if (a.nullable !== b.nullable) {
      diffs.push({
        type: 'nullable_changed',
        path: endpointPath,
        field: fullPath,
        expected: a.nullable,
        actual: b.nullable,
        severity: a.nullable && !b.nullable ? 'breaking' : 'info',
        source: { context: `Nullable changed: ${a.nullable} -> ${b.nullable}` }
      });
    }

    if (a.required !== b.required) {
      const severity = !a.required && b.required ? 'breaking' : 
                       this.options.allowNewOptionalFields ? 'info' : 'warning';
      diffs.push({
        type: 'required_changed',
        path: endpointPath,
        field: fullPath,
        expected: a.required,
        actual: b.required,
        severity,
        source: { context: `Required status changed: ${a.required} -> ${b.required}` }
      });
    }

    if (a.enum && b.enum) {
      const enumA = new Set(a.enum);
      const enumB = new Set(b.enum);
      
      for (const val of a.enum) {
        if (!enumB.has(val)) {
          diffs.push({
            type: 'enum_removed',
            path: endpointPath,
            field: `${fullPath}.enum[${val}]`,
            expected: val,
            severity: 'breaking',
            source: { context: `Enum value '${val}' removed` }
          });
        }
      }

      for (const val of b.enum) {
        if (!enumA.has(val)) {
          diffs.push({
            type: 'enum_added',
            path: endpointPath,
            field: `${fullPath}.enum[${val}]`,
            actual: val,
            severity: this.options.allowNewEnumValues ? 'info' : 'warning',
            source: { context: `New enum value '${val}' added` }
          });
        }
      }
    }

    if (a.items && b.items) {
      diffs.push(...this.compareFieldSchemas(a.items, b.items, `${fullPath}[]`, endpointPath));
    }

    if (a.properties && b.properties) {
      const propsA = new Set(Object.keys(a.properties));
      const propsB = new Set(Object.keys(b.properties));

      for (const prop of Object.keys(a.properties)) {
        if (propsB.has(prop)) {
          diffs.push(...this.compareFieldSchemas(
            a.properties[prop],
            b.properties[prop],
            fullPath,
            endpointPath
          ));
        } else {
          diffs.push({
            type: 'field_removed',
            path: endpointPath,
            field: `${fullPath}.${prop}`,
            severity: a.properties[prop].required ? 'breaking' : 'warning',
            source: { context: `Field '${prop}' is missing` }
          });
        }
      }

      for (const prop of Object.keys(b.properties)) {
        if (!propsA.has(prop)) {
          diffs.push({
            type: 'field_added',
            path: endpointPath,
            field: `${fullPath}.${prop}`,
            severity: b.properties[prop].required ? 'breaking' : 'info',
            source: { context: `New field '${prop}' added` }
          });
        }
      }
    }

    return diffs;
  }
}
