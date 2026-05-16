"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BoundaryGenerator = void 0;
const base_1 = require("./base");
const helpers_1 = require("../utils/helpers");
class BoundaryGenerator extends base_1.BaseGenerator {
    constructor(schema, seed) {
        super(schema, seed);
        this.boundaries = [
            { name: '空字符串', fn: this.setStringBoundary },
            { name: '最小数值', fn: this.setMinNumberBoundary },
            { name: '最大数值', fn: this.setMaxNumberBoundary },
            { name: '最小长度数组', fn: this.setMinArrayBoundary },
            { name: '最大长度数组', fn: this.setMaxArrayBoundary },
            { name: '最小长度字符串', fn: this.setMinStringBoundary },
            { name: '最大长度字符串', fn: this.setMaxStringBoundary }
        ];
    }
    generate(index, fieldPath) {
        const data = this.generateValid();
        const allFields = (0, helpers_1.listAllFields)(this.schema);
        if (allFields.length === 0) {
            return { data, reason: '无可用字段进行边界测试' };
        }
        const targetField = fieldPath || allFields[index % allFields.length];
        const boundaryIndex = Math.floor(index / allFields.length) % this.boundaries.length;
        const boundary = this.boundaries[boundaryIndex];
        try {
            boundary.fn.call(this, data, targetField, this.schema);
            return {
                data,
                reason: `${boundary.name} - 字段: ${targetField}`
            };
        }
        catch {
            return {
                data,
                reason: `边界应用失败，使用默认有效数据`
            };
        }
    }
    setStringBoundary(data, field) {
        this.setPropertyAtPath(data, field, '');
    }
    setMinNumberBoundary(data, field, schema) {
        const fieldSchema = this.getFieldSchema(schema, field);
        const min = fieldSchema?.minimum;
        if (typeof min === 'number') {
            this.setPropertyAtPath(data, field, min);
        }
        else {
            this.setPropertyAtPath(data, field, Number.MIN_SAFE_INTEGER);
        }
    }
    setMaxNumberBoundary(data, field, schema) {
        const fieldSchema = this.getFieldSchema(schema, field);
        const max = fieldSchema?.maximum;
        if (typeof max === 'number') {
            this.setPropertyAtPath(data, field, max);
        }
        else {
            this.setPropertyAtPath(data, field, Number.MAX_SAFE_INTEGER);
        }
    }
    setMinArrayBoundary(data, field, schema) {
        const fieldSchema = this.getFieldSchema(schema, field);
        const minItems = fieldSchema?.minItems;
        const currentValue = this.getPropertyAtPath(data, field);
        if (Array.isArray(currentValue?.value)) {
            const targetLength = typeof minItems === 'number' ? minItems : 0;
            const arr = currentValue.value;
            while (arr.length > targetLength) {
                arr.pop();
            }
        }
    }
    setMaxArrayBoundary(data, field, schema) {
        const fieldSchema = this.getFieldSchema(schema, field);
        const maxItems = fieldSchema?.maxItems;
        const currentValue = this.getPropertyAtPath(data, field);
        if (Array.isArray(currentValue?.value) && typeof maxItems === 'number') {
            const arr = currentValue.value;
            while (arr.length < maxItems) {
                arr.push(arr[0] ?? null);
            }
        }
    }
    setMinStringBoundary(data, field, schema) {
        const fieldSchema = this.getFieldSchema(schema, field);
        const minLength = fieldSchema?.minLength;
        const targetLength = typeof minLength === 'number' ? minLength : 0;
        this.setPropertyAtPath(data, field, 'a'.repeat(targetLength));
    }
    setMaxStringBoundary(data, field, schema) {
        const fieldSchema = this.getFieldSchema(schema, field);
        const maxLength = fieldSchema?.maxLength;
        const targetLength = typeof maxLength === 'number' ? maxLength : 100;
        this.setPropertyAtPath(data, field, 'a'.repeat(targetLength));
    }
    getFieldSchema(schema, fieldPath) {
        const parts = fieldPath.split('.').filter(Boolean);
        let current = schema;
        for (const part of parts) {
            if (current.properties && typeof current.properties === 'object') {
                const props = current.properties;
                if (props[part]) {
                    current = props[part];
                }
                else {
                    return null;
                }
            }
            else {
                return null;
            }
        }
        return current;
    }
}
exports.BoundaryGenerator = BoundaryGenerator;
//# sourceMappingURL=boundary.js.map