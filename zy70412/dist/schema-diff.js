"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchemaDiffer = void 0;
exports.compareSchemas = compareSchemas;
const isEqual_1 = __importDefault(require("lodash/isEqual"));
class SchemaDiffer {
    compare(schema1, schema2, path = '') {
        const diffs = [];
        const allKeys = new Set([...Object.keys(schema1 || {}), ...Object.keys(schema2 || {})]);
        for (const key of allKeys) {
            const currentPath = path ? `${path}.${key}` : key;
            const val1 = schema1?.[key];
            const val2 = schema2?.[key];
            if (val1 === undefined && val2 !== undefined) {
                diffs.push({
                    path: currentPath,
                    type: 'added',
                    newValue: val2
                });
            }
            else if (val2 === undefined && val1 !== undefined) {
                diffs.push({
                    path: currentPath,
                    type: 'removed',
                    oldValue: val1
                });
            }
            else if (typeof val1 === 'object' && typeof val2 === 'object' && val1 !== null && val2 !== null) {
                diffs.push(...this.compare(val1, val2, currentPath));
            }
            else if (!(0, isEqual_1.default)(val1, val2)) {
                if (this.isTypeChange(val1, val2)) {
                    diffs.push({
                        path: currentPath,
                        type: 'type-changed',
                        oldValue: typeof val1,
                        newValue: typeof val2
                    });
                }
                else {
                    diffs.push({
                        path: currentPath,
                        type: 'modified',
                        oldValue: val1,
                        newValue: val2
                    });
                }
            }
        }
        return diffs;
    }
    isTypeChange(val1, val2) {
        const type1 = this.getJsonSchemaType(val1);
        const type2 = this.getJsonSchemaType(val2);
        return type1 !== type2;
    }
    getJsonSchemaType(val) {
        if (val === null)
            return 'null';
        if (Array.isArray(val))
            return 'array';
        return typeof val;
    }
    hasCriticalDiffs(diffs) {
        return diffs.some(diff => diff.type === 'type-changed' ||
            diff.type === 'removed');
    }
    summarizeDiffs(diffs) {
        return {
            critical: diffs.filter(d => d.type === 'type-changed' || d.type === 'removed'),
            minor: diffs.filter(d => d.type === 'added' || d.type === 'modified')
        };
    }
}
exports.SchemaDiffer = SchemaDiffer;
function compareSchemas(schema1, schema2) {
    const differ = new SchemaDiffer();
    return differ.compare(schema1, schema2);
}
