import { EnumDefinition, EnumDiff, EnumValue } from './types';

export class EnumComparator {
  compare(openapiEnums: EnumDefinition[], sourceEnums: EnumDefinition[]): EnumDiff[] {
    const differences: EnumDiff[] = [];

    const openapiMap = this.createEnumMap(openapiEnums);
    const sourceMap = this.createEnumMap(sourceEnums);

    const allNames = new Set([...openapiMap.keys(), ...sourceMap.keys()]);

    for (const name of allNames) {
      const openapiEnum = openapiMap.get(name);
      const sourceEnum = sourceMap.get(name);

      if (openapiEnum && sourceEnum) {
        const diff = this.compareEnumValues(openapiEnum, sourceEnum);
        if (diff.onlyInOpenApi.length > 0 || diff.onlyInSource.length > 0) {
          differences.push(diff);
        }
      } else if (openapiEnum) {
        differences.push({
          enumName: name,
          onlyInOpenApi: openapiEnum.values,
          onlyInSource: []
        });
      } else if (sourceEnum) {
        differences.push({
          enumName: name,
          onlyInOpenApi: [],
          onlyInSource: sourceEnum.values
        });
      }
    }

    return differences;
  }

  compareByName(openapiEnums: EnumDefinition[], sourceEnums: EnumDefinition[], enumNames: string[]): EnumDiff[] {
    const openapiMap = this.createEnumMap(openapiEnums);
    const sourceMap = this.createEnumMap(sourceEnums);

    const differences: EnumDiff[] = [];

    for (const name of enumNames) {
      const openapiEnum = this.findEnumByName(openapiMap, name);
      const sourceEnum = this.findEnumByName(sourceMap, name);

      if (openapiEnum && sourceEnum) {
        const diff = this.compareEnumValues(openapiEnum, sourceEnum);
        if (diff.onlyInOpenApi.length > 0 || diff.onlyInSource.length > 0) {
          differences.push(diff);
        }
      } else if (openapiEnum) {
        differences.push({
          enumName: name,
          onlyInOpenApi: openapiEnum.values,
          onlyInSource: []
        });
      } else if (sourceEnum) {
        differences.push({
          enumName: name,
          onlyInOpenApi: [],
          onlyInSource: sourceEnum.values
        });
      } else {
        differences.push({
          enumName: name,
          onlyInOpenApi: [],
          onlyInSource: []
        });
      }
    }

    return differences;
  }

  private createEnumMap(enums: EnumDefinition[]): Map<string, EnumDefinition> {
    const map = new Map<string, EnumDefinition>();
    for (const e of enums) {
      map.set(e.name, e);
    }
    return map;
  }

  private findEnumByName(map: Map<string, EnumDefinition>, name: string): EnumDefinition | undefined {
    if (map.has(name)) {
      return map.get(name);
    }

    const fuzzyMatch = Array.from(map.keys()).find(key => 
      key.toLowerCase() === name.toLowerCase() ||
      key.includes(name) ||
      name.includes(key)
    );

    return fuzzyMatch ? map.get(fuzzyMatch) : undefined;
  }

  private compareEnumValues(openapiEnum: EnumDefinition, sourceEnum: EnumDefinition): EnumDiff {
    const openapiValues = new Set(openapiEnum.values.map(v => this.normalizeValue(v.value)));
    const sourceValues = new Set(sourceEnum.values.map(v => this.normalizeValue(v.value)));

    const onlyInOpenApi = openapiEnum.values.filter(v => 
      !sourceValues.has(this.normalizeValue(v.value))
    );

    const onlyInSource = sourceEnum.values.filter(v => 
      !openapiValues.has(this.normalizeValue(v.value))
    );

    return {
      enumName: openapiEnum.name,
      onlyInOpenApi,
      onlyInSource
    };
  }

  private normalizeValue(value: string | number): string {
    if (typeof value === 'number') {
      return value.toString();
    }
    return value.trim().toLowerCase();
  }

  getMatchingEnums(openapiEnums: EnumDefinition[], sourceEnums: EnumDefinition[]): string[] {
    const openapiMap = this.createEnumMap(openapiEnums);
    const sourceMap = this.createEnumMap(sourceEnums);

    const matching: string[] = [];

    for (const name of openapiMap.keys()) {
      if (sourceMap.has(name)) {
        const diff = this.compareEnumValues(openapiMap.get(name)!, sourceMap.get(name)!);
        if (diff.onlyInOpenApi.length === 0 && diff.onlyInSource.length === 0) {
          matching.push(name);
        }
      }
    }

    return matching;
  }
}
