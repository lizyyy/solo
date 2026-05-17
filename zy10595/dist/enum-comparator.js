"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnumComparator = void 0;
class EnumComparator {
    compare(openapiEnums, sourceEnums) {
        const differences = [];
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
            }
            else if (openapiEnum) {
                differences.push({
                    enumName: name,
                    onlyInOpenApi: openapiEnum.values,
                    onlyInSource: []
                });
            }
            else if (sourceEnum) {
                differences.push({
                    enumName: name,
                    onlyInOpenApi: [],
                    onlyInSource: sourceEnum.values
                });
            }
        }
        return differences;
    }
    compareByName(openapiEnums, sourceEnums, enumNames) {
        const openapiMap = this.createEnumMap(openapiEnums);
        const sourceMap = this.createEnumMap(sourceEnums);
        const differences = [];
        for (const name of enumNames) {
            const openapiEnum = this.findEnumByName(openapiMap, name);
            const sourceEnum = this.findEnumByName(sourceMap, name);
            if (openapiEnum && sourceEnum) {
                const diff = this.compareEnumValues(openapiEnum, sourceEnum);
                if (diff.onlyInOpenApi.length > 0 || diff.onlyInSource.length > 0) {
                    differences.push(diff);
                }
            }
            else if (openapiEnum) {
                differences.push({
                    enumName: name,
                    onlyInOpenApi: openapiEnum.values,
                    onlyInSource: []
                });
            }
            else if (sourceEnum) {
                differences.push({
                    enumName: name,
                    onlyInOpenApi: [],
                    onlyInSource: sourceEnum.values
                });
            }
            else {
                differences.push({
                    enumName: name,
                    onlyInOpenApi: [],
                    onlyInSource: []
                });
            }
        }
        return differences;
    }
    createEnumMap(enums) {
        const map = new Map();
        for (const e of enums) {
            map.set(e.name, e);
        }
        return map;
    }
    findEnumByName(map, name) {
        if (map.has(name)) {
            return map.get(name);
        }
        const fuzzyMatch = Array.from(map.keys()).find(key => key.toLowerCase() === name.toLowerCase() ||
            key.includes(name) ||
            name.includes(key));
        return fuzzyMatch ? map.get(fuzzyMatch) : undefined;
    }
    compareEnumValues(openapiEnum, sourceEnum) {
        const openapiValues = new Set(openapiEnum.values.map(v => this.normalizeValue(v.value)));
        const sourceValues = new Set(sourceEnum.values.map(v => this.normalizeValue(v.value)));
        const onlyInOpenApi = openapiEnum.values.filter(v => !sourceValues.has(this.normalizeValue(v.value)));
        const onlyInSource = sourceEnum.values.filter(v => !openapiValues.has(this.normalizeValue(v.value)));
        return {
            enumName: openapiEnum.name,
            onlyInOpenApi,
            onlyInSource
        };
    }
    normalizeValue(value) {
        if (typeof value === 'number') {
            return value.toString();
        }
        return value.trim().toLowerCase();
    }
    getMatchingEnums(openapiEnums, sourceEnums) {
        const openapiMap = this.createEnumMap(openapiEnums);
        const sourceMap = this.createEnumMap(sourceEnums);
        const matching = [];
        for (const name of openapiMap.keys()) {
            if (sourceMap.has(name)) {
                const diff = this.compareEnumValues(openapiMap.get(name), sourceMap.get(name));
                if (diff.onlyInOpenApi.length === 0 && diff.onlyInSource.length === 0) {
                    matching.push(name);
                }
            }
        }
        return matching;
    }
}
exports.EnumComparator = EnumComparator;
